import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'pymes-api' };
  }

  @Get('version')
  version() {
    return { deployed: '695b977', modules: ['saml', 'billing', 'routing', 'telegram', 'i18n', 'ai'] };
  }
}
