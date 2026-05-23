import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const PAYPAL_API_BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units?: {
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount: { value: string; currency_code: string };
        status_details?: { reason?: string };
      }[];
    };
  }[];
}

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;
  private readonly environment: string;
  private readonly apiBase: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = config.getOrThrow<string>("PAYPAL_CLIENT_ID");
    this.clientSecret = config.getOrThrow<string>("PAYPAL_CLIENT_SECRET");
    this.webhookId = config.get<string>("PAYPAL_WEBHOOK_ID") || "";
    this.environment = config.get<string>("PAYPAL_ENVIRONMENT") || "sandbox";
    this.apiBase = PAYPAL_API_BASE[this.environment] || PAYPAL_API_BASE.sandbox;
  }

  private async getAccessToken(): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal auth failed: ${res.status} ${text}`);
      throw new BadRequestException("Error de autenticación con PayPal");
    }

    const data = await res.json();
    return data.access_token;
  }

  async createOrder(amountUsd: number): Promise<{ orderId: string }> {
    const token = await this.getAccessToken();

    const body = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amountUsd.toFixed(2),
          },
          description: "Créditos de memoria IA - PymesHub",
        },
      ],
    };

    const res = await fetch(`${this.apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal createOrder failed: ${res.status} ${text}`);
      throw new BadRequestException("No se pudo crear la orden de PayPal");
    }

    const order = await res.json();
    this.logger.log(`PayPal order created: ${order.id} status=${order.status}`);
    return { orderId: order.id };
  }

  async captureOrder(orderId: string): Promise<{ captureId: string; status: string; amount: number }> {
    const token = await this.getAccessToken();

    const res = await fetch(`${this.apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal captureOrder failed: ${res.status} ${text}`);
      throw new BadRequestException("No se pudo capturar el pago de PayPal");
    }

    const order: PayPalCaptureResponse = await res.json();

    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture) {
      throw new BadRequestException("No se encontró el capture en la respuesta de PayPal");
    }

    if (capture.status !== "COMPLETED" && this.environment !== "sandbox") {
      this.logger.warn(`PayPal capture ${capture.id} status=${capture.status}, reason=${capture.status_details?.reason}`);
      throw new BadRequestException(
        `El pago no fue completado (${capture.status})` +
        (capture.status_details?.reason ? `: ${capture.status_details.reason}` : ""),
      );
    }

    const amount = parseFloat(capture.amount?.value || "0");
    this.logger.log(`PayPal order captured: ${orderId} capture=${capture.id} amount=${amount} status=${capture.status}`);
    return { captureId: capture.id, status: capture.status, amount };
  }
}
