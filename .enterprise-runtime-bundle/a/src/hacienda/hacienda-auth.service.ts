import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class HaciendaAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessToken(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace no encontrado.');
    }

    const settings = this.readSettings(workspace.settings_json);
    if (settings.hacienda_access_token) {
      return settings.hacienda_access_token;
    }

    if (!settings.hacienda_token_url || !settings.hacienda_username || !settings.hacienda_password) {
      throw new ServiceUnavailableException(
        'Falta configuración de autenticación Hacienda en el workspace.',
      );
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'password');
    body.set('client_id', settings.hacienda_client_id ?? 'api-stag');
    body.set('username', settings.hacienda_username);
    body.set('password', settings.hacienda_password);

    const response = await fetch(settings.hacienda_token_url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `No se pudo obtener token OIDC de Hacienda: ${response.status} ${text || response.statusText}`,
      );
    }

    const data = await response.json() as { access_token?: string };
    if (!data.access_token) {
      throw new ServiceUnavailableException('Respuesta de token Hacienda sin access_token.');
    }
    return data.access_token;
  }

  private readSettings(settingsJson: unknown): Record<string, any> {
    return settingsJson && typeof settingsJson === 'object'
      ? (settingsJson as Record<string, any>)
      : {};
  }
}
