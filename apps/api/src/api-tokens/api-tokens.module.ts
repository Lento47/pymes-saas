import { Module, Global } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';
import { ApiTokenGuard } from './api-token.guard';
import { ApiRolesGuard } from './api-roles.guard';
import { McpController } from './mcp.controller';

@Global()
@Module({
  controllers: [ApiTokensController, McpController],
  providers: [ApiTokensService, ApiTokenGuard, ApiRolesGuard],
  exports: [ApiTokensService, ApiTokenGuard, ApiRolesGuard],
})
export class ApiTokensModule {}
