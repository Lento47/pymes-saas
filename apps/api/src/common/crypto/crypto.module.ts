import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";
import { PrismaEncryptionService } from "./prisma-encryption.service";
import { PrismaModule } from "../prisma/prisma.module";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [CryptoService, PrismaEncryptionService],
  exports: [CryptoService, PrismaEncryptionService],
})
export class CryptoModule {}
