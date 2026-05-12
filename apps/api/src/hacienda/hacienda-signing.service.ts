import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';

export type SignedXmlResult = {
  signedXml: string;
  signatureMode: 'XADES_EPES' | 'UNSIGNED_PLACEHOLDER';
};

@Injectable()
export class HaciendaSigningService {
  private readonly logger = new Logger(HaciendaSigningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async signXml(workspaceId: string, xml: string): Promise<SignedXmlResult> {
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
      // Dev/test mode only. Callers MUST check signatureMode and must NOT
      // submit UNSIGNED_PLACEHOLDER to Hacienda production.
      this.logger.warn(
        `[${workspaceId}] Firma deshabilitada — XML sin firmar. NO enviar a Hacienda producción.`,
      );
      return { signedXml: xml, signatureMode: 'UNSIGNED_PLACEHOLDER' };
    }

    // From here on, any failure throws — we never silently return unsigned XML
    // when signing is explicitly enabled.
    const certPath = settings.hacienda_certificate_path as string | undefined;
    if (!certPath) {
      throw new BadRequestException(
        'No hay ruta de certificado configurada. Ve a Configuración > Facturación electrónica CR.',
      );
    }
    if (!fs.existsSync(certPath)) {
      throw new BadRequestException(
        'Certificado fiscal no encontrado en la ruta configurada. Verifica la ruta del certificado.',
      );
    }
    const resolvedCertPath = path.resolve(certPath);
    const ext = resolvedCertPath.toLowerCase();
    if (!ext.endsWith('.p12') && !ext.endsWith('.pfx')) {
      throw new BadRequestException('El certificado debe ser un archivo .p12 o .pfx.');
    }

    const pinEnc = settings.hacienda_certificate_pin_enc as string | undefined;
    if (!pinEnc) {
      throw new BadRequestException(
        'PIN del certificado no configurado. Configura el PIN en Configuración > Facturación electrónica CR.',
      );
    }

    let pin: string;
    try {
      pin = this.cryptoService.decrypt(pinEnc);
    } catch {
      throw new BadRequestException(
        'No se pudo descifrar el PIN del certificado. Reconfigura el certificado fiscal.',
      );
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hacienda-sign-'));
    try {
      const certPem = this.extractCert(resolvedCertPath, pin, tmpDir);
      const privKeyPem = this.extractKey(resolvedCertPath, pin, tmpDir);
      return this.buildSignedXml(xml, privKeyPem, certPem);
    } catch (err) {
      const message = (err as Error).message ?? 'error desconocido';
      this.logger.error(`Firma XAdES-EPES fallida [workspace=${workspaceId}]: ${message}`);
      // Re-throw BadRequestException as-is; wrap anything else
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Error al firmar el XML fiscal: ${message}`);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* cleanup */ }
    }
  }

  // Uses execFileSync (not execSync) with args as array to prevent shell injection.
  // PIN is passed via a temp file (not a shell string) to avoid exposure in process list.
  private extractCert(p12Path: string, pin: string, tmpDir: string): string {
    const outPath = path.join(tmpDir, 'cert.pem');
    const pinFile = path.join(tmpDir, 'pin.txt');
    fs.writeFileSync(pinFile, pin, { mode: 0o600 });
    try {
      execFileSync('openssl', [
        'pkcs12', '-in', p12Path, '-clcerts', '-nokeys',
        '-passin', `file:${pinFile}`, '-out', outPath,
      ], { timeout: 5_000, stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(pinFile); } catch { /* cleanup */ }
    }
    return fs.readFileSync(outPath, 'utf8');
  }

  private extractKey(p12Path: string, pin: string, tmpDir: string): string {
    const outPath = path.join(tmpDir, 'key.pem');
    const pinFile = path.join(tmpDir, 'pin2.txt');
    fs.writeFileSync(pinFile, pin, { mode: 0o600 });
    try {
      execFileSync('openssl', [
        'pkcs12', '-in', p12Path, '-nocerts', '-nodes',
        '-passin', `file:${pinFile}`, '-out', outPath,
      ], { timeout: 5_000, stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(pinFile); } catch { /* cleanup */ }
    }
    return fs.readFileSync(outPath, 'utf8');
  }

  private buildSignedXml(xml: string, privKeyPem: string, certPem: string): SignedXmlResult {
    const x509 = new crypto.X509Certificate(certPem);
    const certBase64 = x509.raw.toString('base64');
    const issuerDN = x509.issuer.replace(/\n/g, '');
    const serialNumber = x509.serialNumber;
    const signingTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const refId = `Reference-${crypto.randomBytes(4).toString('hex')}`;

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
<DigestValue>${this.computeDigest(this.buildSignedPropertiesXml(signingTime))}</DigestValue>
</Reference>
</SignedInfo>`;

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

    // Inject dsig/xades namespaces into the document root element without
    // hardcoding the tag name — works for FacturaElectronica, TiqueteElectronico,
    // NotaCreditoElectronica, NotaDebitoElectronica, MensajeReceptor, etc.
    const namespacedXml = xml.replace(
      /(<\?xml[^?]*\?>\s*)?(<[A-Za-z][A-Za-z0-9]*)/,
      (match, prolog, rootOpen) =>
        `${prolog ?? ''}${rootOpen} xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"`,
    );

    const signedXml = this.insertSignature(namespacedXml, signature);
    return { signedXml, signatureMode: 'XADES_EPES' };
  }

  private computeDigest(xml: string): string {
    return crypto.createHash('sha256').update(xml).digest('base64');
  }

  private buildSignedPropertiesXml(signingTime: string): string {
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
    const firstTagEnd = xml.indexOf('>');
    if (firstTagEnd === -1) return xml + signature;
    return xml.slice(0, firstTagEnd + 1) + '\n' + signature + xml.slice(firstTagEnd + 1);
  }
}
