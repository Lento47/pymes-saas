import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HaciendaAuthService } from './hacienda-auth.service';

@Injectable()
export class HaciendaRecepcionService {
  private readonly baseUrl = 'https://api.comprobanteselectronicos.go.cr/recepcion/v1';

  constructor(private readonly authService: HaciendaAuthService) {}

  async submitComprobante(workspaceId: string, payload: {
    clave: string;
    fecha: string;
    emisor: { tipoIdentificacion: string; numeroIdentificacion: string };
    receptor?: { tipoIdentificacion: string; numeroIdentificacion: string };
    callbackUrl?: string;
    consecutivoReceptor?: string;
    comprobanteXml: string;
  }) {
    const token = await this.authService.getAccessToken(workspaceId);
    const response = await fetch(`${this.baseUrl}/recepcion`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `Hacienda recepción respondió ${response.status}: ${text || response.statusText}`,
      );
    }

    return {
      location: response.headers.get('Location'),
      rateLimit: {
        limit: response.headers.get('X-Ratelimit-Limit'),
        remaining: response.headers.get('X-Ratelimit-Remaining'),
        reset: response.headers.get('X-Ratelimit-Reset'),
      },
      statusCode: response.status,
    };
  }

  async getRecepcionStatus(workspaceId: string, clave: string) {
    const token = await this.authService.getAccessToken(workspaceId);
    const response = await fetch(`${this.baseUrl}/recepcion/${encodeURIComponent(clave)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `Consulta de recepción Hacienda respondió ${response.status}: ${text || response.statusText}`,
      );
    }

    return response.json();
  }

  async listComprobantes(workspaceId: string, params: Record<string, string | number | undefined>) {
    const token = await this.authService.getAccessToken(workspaceId);
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/comprobantes?${query.toString()}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `Listado de comprobantes Hacienda respondió ${response.status}: ${text || response.statusText}`,
      );
    }

    return response.json();
  }

  async getComprobante(workspaceId: string, clave: string) {
    const token = await this.authService.getAccessToken(workspaceId);
    const response = await fetch(`${this.baseUrl}/comprobantes/${encodeURIComponent(clave)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `Consulta de comprobante Hacienda respondió ${response.status}: ${text || response.statusText}`,
      );
    }

    return response.json();
  }
}
