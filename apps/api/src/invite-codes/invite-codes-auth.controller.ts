import { Body, Controller, Post } from '@nestjs/common';
import { InviteCodesService } from './invite-codes.service';

@Controller('auth')
export class InviteCodesAuthController {
  constructor(private readonly service: InviteCodesService) {}

  @Post('invite-code-preview')
  preview(@Body() dto: { code: string }) {
    return this.service.redeem(dto.code);
  }
}
