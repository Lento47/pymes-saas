import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { InviteCodesService } from "./invite-codes.service";

@Controller("auth")
export class InviteCodesAuthController {
  constructor(private readonly service: InviteCodesService) {}

  @Post("invite-code-preview")
  @Throttle({ auth: { limit: 5, ttl: 15 * 60_000 } })
  async preview(@Body() dto: { code: string }) {
    await this.service.redeem(dto.code);
    return {
      valid: true,
    };
  }
}
