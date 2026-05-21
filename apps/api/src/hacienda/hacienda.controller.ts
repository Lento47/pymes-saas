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
import { HaciendaPublicApiService } from "./hacienda-public-api.service";
import { FiscalCertificateService } from "./fiscal-certificate.service";

@Controller("hacienda")
@UseGuards(JwtAuthGuard, RolesGuard)
export class HaciendaController {
  constructor(
    private readonly publicApi: HaciendaPublicApiService,
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
