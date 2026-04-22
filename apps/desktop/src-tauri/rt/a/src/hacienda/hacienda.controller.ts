import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HaciendaPublicApiService } from './hacienda-public-api.service';

@Controller('hacienda')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HaciendaController {
  constructor(private readonly publicApi: HaciendaPublicApiService) {}

  @Post('validate-taxpayer')
  validateTaxpayer(@Body('identificacion') identificacion: string) {
    return this.publicApi.validateTaxpayer(identificacion);
  }

  @Get('cabys')
  getCabys(
    @Query('q') q?: string,
    @Query('codigo') codigo?: string,
    @Query('top') top?: string,
  ) {
    return this.publicApi.searchCabys({
      q,
      codigo,
      top: top ? Number(top) : undefined,
    });
  }

  @Get('exonerations/:authorization')
  getExoneration(@Param('authorization') authorization: string) {
    return this.publicApi.getExoneration(authorization);
  }

  @Get('exchange-rate')
  getExchangeRate() {
    return this.publicApi.getExchangeRate();
  }
}
