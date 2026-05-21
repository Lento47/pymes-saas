import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global() // disponible en toda la app sin re-importar
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
