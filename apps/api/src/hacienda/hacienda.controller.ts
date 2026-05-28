import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { WorkspaceUserRole, FiscalEnvironment } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { PrismaService } from "../common/prisma/prisma.service";
import { HaciendaAuthService } from "./hacienda-auth.service";
import { HaciendaPublicApiService } from "./hacienda-public-api.service";
import { HaciendaRecepcionService } from "./hacienda-recepcion.service";
import { HaciendaSigningService } from "./hacienda-signing.service";
import { HaciendaXmlBuilderService } from "./hacienda-xml-builder.service";
import { HaciendaXmlValidatorService } from "./hacienda-xml-validator.service";
import { FiscalSequenceService } from "./fiscal-sequence.service";
import { FiscalCertificateService } from "./fiscal-certificate.service";

@Controller("hacienda")
@UseGuards(JwtAuthGuard, RolesGuard)
export class HaciendaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: HaciendaAuthService,
    private readonly publicApi: HaciendaPublicApiService,
    private readonly recepcion: HaciendaRecepcionService,
    private readonly signing: HaciendaSigningService,
    private readonly xmlBuilder: HaciendaXmlBuilderService,
    private readonly xmlValidator: HaciendaXmlValidatorService,
    private readonly fiscalSequence: FiscalSequenceService,
    private readonly fiscalCertificate: FiscalCertificateService,
  ) {}

  // ── Public API utilities ────────────────────────────────────────────────

  @Post("validate-taxpayer")
  validateTaxpayer(@Body("identificacion") identificacion: string) {
    return this.publicApi.validateTaxpayer(identificacion);
  }

  @Get("cabys")
  getCabys(@Query("q") q?: string, @Query("codigo") codigo?: string, @Query("top") top?: string) {
    return this.publicApi.searchCabys({
      q,
      codigo,
      top: top ? Number(top) : undefined,
    });
  }

  @Get("exonerations/:authorization")
  getExoneration(@Param("authorization") authorization: string) {
    return this.publicApi.getExoneration(authorization);
  }

  @Get("exchange-rate")
  getExchangeRate() {
    return this.publicApi.getExchangeRate();
  }

  // ── Integration diagnostic ──────────────────────────────────────────────

  /**
   * POST /hacienda/test
   * Runs a step-by-step diagnostic of the Hacienda integration for this workspace:
   *   1. auth      — OIDC token from Hacienda
   *   2. xml_build — Build + validate a minimal test comprobante XML
   *   3. sign      — Sign the XML with the workspace certificate
   *   4. submit    — Submit to Hacienda staging (skipped if env=production)
   *
   * The test uses situation code "3" (sin renovación) so Hacienda treats it as
   * a test document. Does NOT increment the fiscal sequence counter.
   */
  @Post("test")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  async testIntegration(@CurrentUser("workspace_id") workspaceId: string) {
    type Step = { step: string; ok: boolean; detail?: string };
    const steps: Step[] = [];

    // 1. Auth
    try {
      await this.authService.getAccessToken(workspaceId);
      steps.push({ step: "auth", ok: true, detail: "Token OIDC obtenido de Hacienda" });
    } catch (err) {
      steps.push({ step: "auth", ok: false, detail: (err as Error).message });
      return { ok: false, steps };
    }

    // Workspace settings + tax profile
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true, workspace_tax_profile: true },
    });
    const settings = (workspace?.settings_json ?? {}) as Record<string, any>;
    const taxProfile = (workspace as any)?.workspace_tax_profile as Record<string, any> | null;
    const isStaging = (settings.hacienda_environment ?? "staging") !== "production";

    // 2. XML build
    let testXml: string | null = null;
    let testClave: string | null = null;
    if (taxProfile?.identification_number) {
      try {
        const testConsecutivo = "00100010100000000099";
        testClave = this.fiscalSequence.generateClave({
          issueDate: new Date(),
          issuerIdentification: taxProfile.identification_number,
          consecutivo: testConsecutivo,
          situation: "3",
        });
        testXml = this.xmlBuilder.buildInvoiceXml({
          invoice: {
            clave: testClave,
            consecutivo: testConsecutivo,
            issue_date: new Date(),
            document_type: "FACTURA_ELECTRONICA",
          },
          workspaceTaxProfile: taxProfile,
          contact: {
            company_name: taxProfile.legal_name ?? "Diagnóstico PymesHub",
            identification_type: taxProfile.identification_type ?? "01",
            identification_number: taxProfile.identification_number,
            email: taxProfile.tax_email ?? "diagnostico@pymeshub.lat",
          },
          lines: [
            {
              line_number: 1,
              cabys_code: "9999999999999",
              description: "Prueba diagnóstico — no es comprobante real",
              quantity: 1,
              unit_of_measure: "Unid",
              unit_price: 100,
              discount_amount: 0,
              subtotal: 100,
              tax_code: "01",
              tax_rate: 13,
              tax_amount: 13,
              total_line_amount: 113,
            },
          ],
        });
        this.xmlValidator.validate(testXml);
        steps.push({ step: "xml_build", ok: true, detail: "XML válido generado con perfil tributario" });
      } catch (err) {
        steps.push({ step: "xml_build", ok: false, detail: (err as Error).message });
        testXml = null;
      }
    } else {
      steps.push({ step: "xml_build", ok: false, detail: "Sin perfil tributario configurado (falta NIT/cédula)" });
    }

    // 3. Sign
    let signedXml: string | null = null;
    if (testXml) {
      try {
        const result = await this.signing.signXml(workspaceId, testXml);
        signedXml = result.signedXml;
        steps.push({ step: "sign", ok: true, detail: `Modo: ${result.signatureMode}` });
      } catch (err) {
        steps.push({ step: "sign", ok: false, detail: (err as Error).message });
      }
    }

    // 4. Submit — staging only
    if (signedXml && testClave && taxProfile && isStaging) {
      try {
        const issueDate = new Date();
        const dateStr = issueDate.toISOString().replace(/\.\d{3}Z$/, "") + "-06:00";
        const result = await this.recepcion.submitComprobante(workspaceId, {
          clave: testClave,
          fecha: dateStr,
          emisor: {
            tipoIdentificacion: taxProfile.identification_type ?? "",
            numeroIdentificacion: taxProfile.identification_number ?? "",
          },
          comprobanteXml: Buffer.from(signedXml, "utf8").toString("base64"),
        });
        steps.push({
          step: "submit",
          ok: true,
          detail: `Hacienda staging aceptó el comprobante (HTTP ${result.statusCode}) — Location: ${result.location}`,
        });
      } catch (err) {
        steps.push({ step: "submit", ok: false, detail: (err as Error).message });
      }
    } else if (!isStaging) {
      steps.push({ step: "submit", ok: true, detail: "Omitido en producción — no se envían comprobantes de prueba" });
    }

    return {
      ok: steps.every((s) => s.ok),
      environment: isStaging ? "staging" : "production",
      steps,
    };
  }

  // ── Fiscal certificates ─────────────────────────────────────────────────

  /**
   * POST /hacienda/certificates
   * Upload a PKCS#12 (.p12/.pfx) certificate for fiscal document signing.
   * Only ADMIN/OWNER can manage certificates.
   * Returns only public metadata — never returns the raw cert, storage key, or PIN.
   */
  @Post("certificates")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @UseInterceptors(FileInterceptor("certificate"))
  uploadCertificate(
    @CurrentUser("workspace_id") workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("pin") pin: string,
    @Body("environment") environment?: string,
  ) {
    const env =
      environment === "PRODUCTION" ? FiscalEnvironment.PRODUCTION : FiscalEnvironment.STAGING;

    return this.fiscalCertificate.upload({
      workspaceId,
      environment: env,
      file: {
        buffer: file?.buffer,
        mimetype: file?.mimetype,
        originalname: file?.originalname,
      },
      pin,
    });
  }

  @Get("certificates")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  listCertificates(@CurrentUser("workspace_id") workspaceId: string) {
    return this.fiscalCertificate.list(workspaceId);
  }

  @Delete("certificates/:id")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  revokeCertificate(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.fiscalCertificate.revoke(workspaceId, id);
  }
}
