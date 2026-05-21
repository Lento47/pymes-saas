import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { StorageService } from "../common/storage/storage.service";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import { FiscalEnvironment } from "@prisma/client";

const CERT_MAX_BYTES = 2_000_000;
const ALLOWED_MIME_TYPES = ["application/x-pkcs12", "application/octet-stream"];

export type CertificateMetadata = {
  id: string;
  fingerprint_sha256: string;
  subject: string | null;
  issuer: string | null;
  serial_number: string | null;
  valid_from: Date | null;
  valid_until: Date | null;
  status: string;
  environment: string;
  created_at: Date;
};

@Injectable()
export class FiscalCertificateService {
  private readonly logger = new Logger(FiscalCertificateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly storage: StorageService,
  ) {}

  async upload(params: {
    workspaceId: string;
    environment: FiscalEnvironment;
    file: { buffer: Buffer; mimetype: string; originalname: string };
    pin: string;
  }): Promise<CertificateMetadata> {
    const { workspaceId, environment, file, pin } = params;

    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("Archivo de certificado vacío o inválido.");
    }
    if (file.buffer.length > CERT_MAX_BYTES) {
      throw new BadRequestException("El certificado no debe exceder 2 MB.");
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Solo se aceptan archivos .p12 o .pfx (PKCS#12).");
    }
    const ext = (file.originalname ?? "").toLowerCase();
    if (!ext.endsWith(".p12") && !ext.endsWith(".pfx")) {
      throw new BadRequestException("El archivo debe tener extensión .p12 o .pfx.");
    }
    if (!pin || pin.length < 4) {
      throw new BadRequestException("PIN del certificado inválido (mínimo 4 caracteres).");
    }

    // Extract cert metadata and validate PIN using a temp file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cert-upload-"));
    let certPem: string;
    try {
      const p12Path = path.join(tmpDir, "cert.p12");
      const pinFile = path.join(tmpDir, "pin.txt");
      const pemOut = path.join(tmpDir, "cert.pem");

      fs.writeFileSync(p12Path, file.buffer);
      fs.writeFileSync(pinFile, pin, { mode: 0o600 });

      try {
        execFileSync(
          "openssl",
          [
            "pkcs12",
            "-in",
            p12Path,
            "-clcerts",
            "-nokeys",
            "-passin",
            `file:${pinFile}`,
            "-out",
            pemOut,
          ],
          { timeout: 5_000, stdio: "pipe" },
        );
      } catch {
        throw new BadRequestException("PIN incorrecto o certificado inválido.");
      } finally {
        try {
          fs.unlinkSync(pinFile);
        } catch {
          /* cleanup */
        }
      }

      certPem = fs.readFileSync(pemOut, "utf8");
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* cleanup */
      }
    }

    const x509 = new crypto.X509Certificate(certPem);
    const fingerprint = crypto.createHash("sha256").update(x509.raw).digest("hex");

    // Deactivate any previous active certificate for the same environment
    await this.prisma.fiscalCertificate.updateMany({
      where: { workspace_id: workspaceId, environment, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });

    const storageKey = `fiscal/${workspaceId}/certificates/${fingerprint}.p12`;
    await this.storage.upload(storageKey, file.buffer, "application/x-pkcs12");

    const encryptedPin = this.cryptoService.encrypt(pin);

    const cert = await this.prisma.fiscalCertificate.create({
      data: {
        workspace_id: workspaceId,
        environment,
        storage_key: storageKey,
        encrypted_pin: encryptedPin,
        fingerprint_sha256: fingerprint,
        subject: x509.subject || null,
        issuer: x509.issuer || null,
        serial_number: x509.serialNumber || null,
        valid_from: x509.validFrom ? new Date(x509.validFrom) : null,
        valid_until: x509.validTo ? new Date(x509.validTo) : null,
        status: "ACTIVE",
      },
    });

    this.logger.log(
      `Certificado fiscal cargado [workspace=${workspaceId}, env=${environment}, fingerprint=${fingerprint}]`,
    );

    return this.toMetadata(cert);
  }

  async getActive(
    workspaceId: string,
    environment: FiscalEnvironment,
  ): Promise<CertificateMetadata | null> {
    const cert = await this.prisma.fiscalCertificate.findFirst({
      where: { workspace_id: workspaceId, environment, status: "ACTIVE" },
      orderBy: { created_at: "desc" },
    });
    return cert ? this.toMetadata(cert) : null;
  }

  async list(workspaceId: string): Promise<CertificateMetadata[]> {
    const certs = await this.prisma.fiscalCertificate.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
    });
    return certs.map(this.toMetadata);
  }

  async revoke(workspaceId: string, id: string): Promise<CertificateMetadata> {
    const cert = await this.prisma.fiscalCertificate.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!cert) throw new NotFoundException("Certificado no encontrado.");

    const updated = await this.prisma.fiscalCertificate.update({
      where: { id },
      data: { status: "REVOKED" },
    });
    return this.toMetadata(updated);
  }

  private toMetadata(cert: Record<string, any>): CertificateMetadata {
    // Never return storage_key, encrypted_pin, or raw cert data
    return {
      id: cert.id,
      fingerprint_sha256: cert.fingerprint_sha256,
      subject: cert.subject,
      issuer: cert.issuer,
      serial_number: cert.serial_number,
      valid_from: cert.valid_from,
      valid_until: cert.valid_until,
      status: cert.status,
      environment: cert.environment,
      created_at: cert.created_at,
    };
  }
}
