import { Module, Global } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';
import { ApiTokenGuard } from './api-token.guard';
import { ApiRolesGuard } from './api-roles.guard';

@Global()
@Module({
  controllers: [ApiTokensController],
  providers: [ApiTokensService, ApiTokenGuard, ApiRolesGuard],
  exports: [ApiTokensService, ApiTokenGuard, ApiRolesGuard],
})
export class ApiTokensModule {}
