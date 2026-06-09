import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "./crypto.service";

/**
 * Prisma encryption — currently handled at the service layer (ChannelsService)
 * for Channel.config_json fields (access_token_encrypted, bot_token_encrypted).
 *
 * Prisma v7 removed $use() middleware and $extends() returns a Proxy-based
 * client that cannot be retroactively patched onto an existing PrismaService
 * instance. Transparent model-level encryption is deferred until PrismaService
 * is constructed with extensions at init time.
 *
 * This service is kept as a placeholder for future encryption registry.
 */
@Injectable()
export class PrismaEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(PrismaEncryptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  onModuleInit() {
    this.logger.log(
      "Prisma encryption: transparent model-level encryption deferred (handled at service layer)",
    );
  }
}
