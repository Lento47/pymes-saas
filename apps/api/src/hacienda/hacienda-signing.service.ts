import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

@Injectable()
export class HaciendaSigningService {
  private readonly logger = new Logger(HaciendaSigningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async signXml(workspaceId: string, xml: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings =
      workspace?.settings_json && typeof workspace.settings_json === 'object'
        ? (workspace.settings_json as Record<string, any>)
        : {};

    const signingEnabled = settings.hacienda_signing_enabled === true;
    if (!signingEnabled) {
      return { signedXml: xml, signatureMode: 'UNSIGNED_PLACEHOLDER' };
    }

    const certPath = settings.hacienda_certificate_path;
    if (!certPath || !fs.existsSync(certPath)) {
      this.logger.warn(`Certificate not found at ${certPath} — returning unsigned XML`);
      return { signedXml: xml, signatureMode: 'CERTIFICATE_NOT_FOUND' };
    }

    const pinEnc = settings.hacienda_certificate_pin_enc;
    if (!pinEnc) {
      this.logger.warn('Certificate PIN not configured — returning unsigned XML');
      return { signedXml: xml, signatureMode: 'PIN_NOT_CONFIGURED' };
    }

    let pin: string;
    try {
      pin = this.cryptoService.decrypt(pinEnc);
    } catch {
      this.logger.error('Failed to decrypt certificate PIN');
      return { signedXml: xml, signatureMode: 'DECRYPT_FAILED' };
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hacienda-sign-'));
    try {
      const certPem = this.extractCert(certPath, pin, tmpDir);
      const privKeyPem = this.extractKey(certPath, pin, tmpDir);
      return this.buildSignedXml(xml, privKeyPem, certPem);
    } catch (err) {
      this.logger.error(`XAdES-EPES signing failed: ${(err as Error).message}`);
      return { signedXml: xml, signatureMode: 'SIGNING_FAILED' };
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* cleanup */ }
    }
  }

  private extractCert(p12Path: string, pin: string, tmpDir: string): string {
    const outPath = path.join(tmpDir, 'cert.pem');
    const escapedPin = pin.replace(/'/g, "'\\''");
    execSync(`openssl pkcs12 -in "${p12Path}" -clcerts -nokeys -passin pass:'${escapedPin}' -out "${outPath}" 2>/dev/null`, { timeout: 5000 });
    return fs.readFileSync(outPath, 'utf8');
  }

  private extractKey(p12Path: string, pin: string, tmpDir: string): string {
    const outPath = path.join(tmpDir, 'key.pem');
    const escapedPin = pin.replace(/'/g, "'\\''");
    execSync(`openssl pkcs12 -in "${p12Path}" -nocerts -nodes -passin pass:'${escapedPin}' -out "${outPath}" 2>/dev/null`, { timeout: 5000 });
    return fs.readFileSync(outPath, 'utf8');
  }

  private buildSignedXml(
    xml: string,
    privKeyPem: string,
    certPem: string,
  ) {
    const x509 = new crypto.X509Certificate(certPem);
    const certBase64 = x509.raw.toString('base64');
    const issuerDN = x509.issuer.replace(/\n/g, '');
    const serialNumber = x509.serialNumber;
    const signingTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const refId = `Reference-${crypto.randomBytes(4).toString('hex')}`;

    // Build SignedInfo
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>
<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>
<Reference Id="${refId}" URI="">
<Transforms>
<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>
</Transforms>
<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>
<DigestValue>${this.computeDigest(xml)}</DigestValue>
</Reference>
<Reference URI="#SignedProperties">
<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>
<DigestValue>${this.computeDigest(this.buildSignedProperties(signingTime, x509))}</DigestValue>
</Reference>
</SignedInfo>`;

    // Canonicalize and sign
    const c14nSignedInfo = this.canonicalize(signedInfo);
    const signatureValue = this.rsaSign(c14nSignedInfo, privKeyPem);

    const signature = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
${signedInfo}
<SignatureValue>${signatureValue}</SignatureValue>
<KeyInfo>
<X509Data>
<X509Certificate>${certBase64}</X509Certificate>
</X509Data>
</KeyInfo>
<Object>
<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${refId}">
<xades:SignedProperties Id="SignedProperties">
<xades:SignedSignatureProperties>
<xades:SigningTime>${signingTime}</xades:SigningTime>
<xades:SigningCertificate>
<xades:Cert>
<xades:CertDigest>
<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
<ds:DigestValue>${crypto.createHash('sha256').update(x509.raw).digest('base64')}</ds:DigestValue>
</xades:CertDigest>
<xades:IssuerSerial>
<ds:X509IssuerName>${issuerDN}</ds:X509IssuerName>
<ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>
</xades:IssuerSerial>
</xades:Cert>
</xades:SigningCertificate>
</xades:SignedSignatureProperties>
</xades:SignedProperties>
</xades:QualifyingProperties>
</Object>
</ds:Signature>`;

    // XML namespace declaration
    const namespacedXml = xml.replace(
      '<FacturaElectronica>',
      `<FacturaElectronica xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">`,
    );

    const signedXml = this.insertSignature(namespacedXml, signature);
    return { signedXml, signatureMode: 'XADES_EPES' };
  }

  private computeDigest(xml: string): string {
    return crypto.createHash('sha256').update(xml).digest('base64');
  }

  private buildSignedProperties(signingTime: string, x509: crypto.X509Certificate): string {
    return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="SignedProperties">
<xades:SignedSignatureProperties>
<xades:SigningTime>${signingTime}</xades:SigningTime>
</xades:SignedSignatureProperties>
</xades:SignedProperties>`;
  }

  private canonicalize(xml: string): string {
    return xml.replace(/\s+</g, '<').replace(/>\s+/g, '>').trim();
  }

  private rsaSign(data: string, privKeyPem: string): string {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(privKeyPem, 'base64');
  }

  private insertSignature(xml: string, signature: string): string {
    // Insert right after the opening tag
    const firstTagEnd = xml.indexOf('>');
    if (firstTagEnd === -1) return xml + signature;
    return xml.slice(0, firstTagEnd + 1) + '\n' + signature + xml.slice(firstTagEnd + 1);
  }
}
