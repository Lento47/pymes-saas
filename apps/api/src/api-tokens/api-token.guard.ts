import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization || request.headers['x-pymeshub-api-token'] || '';

    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

    if (!token.startsWith('pym_')) {
      // Not a PymeHub API token — let JWT guard handle it
      return true;
    }

    const result = await this.apiTokensService.validateToken(token);
    if (!result) {
      throw new UnauthorizedException('Invalid API token');
    }

    // Attach workspace context to request
    request.workspace_id = result.workspaceId;
    request.api_token_authenticated = true;

    return true;
  }
}
