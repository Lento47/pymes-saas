import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

@Injectable()
export class HaciendaPublicApiService {
  private readonly baseUrl = "https://api.hacienda.go.cr";
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>();

  async validateTaxpayer(identificacion: string) {
    if (!/^\d{9,12}$/.test(identificacion)) {
      throw new BadRequestException("La identificación debe tener entre 9 y 12 dígitos.");
    }
    return this.getCached(`taxpayer:${identificacion}`, 1000 * 60 * 60, () =>
      this.getJson(`/fe/ae?identificacion=${encodeURIComponent(identificacion)}`),
    );
  }

  async searchCabys(params: { q?: string; codigo?: string; top?: number }) {
    const search = new URLSearchParams();
    if (params.codigo) search.set("codigo", params.codigo);
    if (params.q) search.set("q", params.q);
    if (params.top) search.set("top", String(params.top));
    if (!search.has("codigo") && !search.has("q")) {
      throw new BadRequestException("Debe enviar `codigo` o `q` para consultar CABYS.");
    }
    return this.getCached(`cabys:${search.toString()}`, 1000 * 60 * 30, () =>
      this.getJson(`/fe/cabys?${search.toString()}`),
    );
  }

  async getExoneration(authorization: string) {
    if (!authorization?.trim()) {
      throw new BadRequestException("La autorización de exoneración es obligatoria.");
    }
    return this.getCached(`exoneration:${authorization.toLowerCase()}`, 1000 * 60 * 30, () =>
      this.getJson(`/fe/ex?autorizacion=${encodeURIComponent(authorization)}`),
    );
  }

  async getExchangeRate() {
    return this.getCached("exchange-rate:dolar", 1000 * 60 * 60, () =>
      this.getJson("/indicadores/tc"),
    );
  }

  private async getCached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > now) {
      return existing.value as T;
    }

    const value = await factory();
    this.cache.set(key, { expiresAt: now + ttlMs, value });
    return value;
  }

  private async getJson(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `Hacienda API pública respondió ${response.status}: ${text || response.statusText}`,
      );
    }
    return response.json();
  }
}
