import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AiTokenMeteringService } from "./ai-token-metering.service";
import { AiTokensController } from "./ai-tokens.controller";

@Module({
  imports: [PrismaModule],
  providers: [AiTokenMeteringService],
  controllers: [AiTokensController],
  exports: [AiTokenMeteringService],
})
export class AiTokensModule {}
