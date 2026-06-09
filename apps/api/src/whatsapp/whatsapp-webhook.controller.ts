import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import * as crypto from "crypto";
import { WhatsAppService } from "./whatsapp.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { PrismaService } from "../common/prisma/prisma.service";

@Controller("inbound/whatsapp")
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly crypto: CryptoService,
    private readonly prisma: PrismaService,
  ) {}

  /** GET /inbound/whatsapp/webhook — verificación de Meta */
  @Get("webhook")
  verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
    @Res() res: Response,
  ) {
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (result === null) {
      return res.status(403).send("Forbidden");
    }
    return res.status(200).send(result);
  }

  /** POST /inbound/whatsapp/webhook — mensajes entrantes */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @Throttle({ webhook: { limit: 200, ttl: 60_000 } })
  async receiveWebhook(
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Body() payload: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // Per-channel signature verification (app_secret_encrypted in channel config_json)
    try {
      const phoneNumberId = this.extractPhoneNumberId(payload);
      if (phoneNumberId && signature) {
        const channel = await this.prisma.channel.findFirst({
          where: {
            type: "WHATSAPP",
            config_json: { path: ["phone_number_id"], equals: phoneNumberId },
            status: "ACTIVE",
          },
          select: { config_json: true },
        });

        if (channel?.config_json) {
          const cfg = (channel.config_json as Record<string, any>) ?? {};
          if (cfg.app_secret_encrypted) {
            const appSecret = this.crypto.decrypt(cfg.app_secret_encrypted);
            const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
            if (!this.verifySignature(appSecret, signature!, rawBody)) {
              this.logger.warn(
                `Invalid WhatsApp webhook signature for phone_number_id=${phoneNumberId}`,
              );
              throw new UnauthorizedException("Invalid webhook signature");
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`Webhook signature verification skipped: ${(err as Error).message}`);
    }

    // Process the webhook
    const result = await this.whatsappService.ingestWebhook(payload);

    if (!result.persisted) {
      this.logger.error("Failed to persist webhook event — returning error to Meta");
      throw new Error("Service unavailable");
    }

    if (result.duplicate) {
      this.logger.log("Duplicate webhook acknowledged — returning 200 to Meta");
    }

    return { ok: true };
  }

  private extractPhoneNumberId(payload: any): string | null {
    try {
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      return value?.metadata?.phone_number_id ?? null;
    } catch {
      return null;
    }
  }

  private verifySignature(appSecret: string, signature: string, rawBody: Buffer): boolean {
    try {
      const expected =
        "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }
}
