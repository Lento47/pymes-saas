import { Module } from "@nestjs/common";
import { InviteCodesService } from "./invite-codes.service";
import { InviteCodesController } from "./invite-codes.controller";
import { InviteCodesAuthController } from "./invite-codes-auth.controller";

@Module({
  controllers: [InviteCodesController, InviteCodesAuthController],
  providers: [InviteCodesService],
  exports: [InviteCodesService],
})
export class InviteCodesModule {}
