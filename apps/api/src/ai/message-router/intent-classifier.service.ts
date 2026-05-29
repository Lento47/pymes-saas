import { Injectable } from "@nestjs/common";
import { Intent } from "./types";

// ── Pattern sets (Spanish-first, English fallback) ───────────────────────────

const OPT_OUT = [
  /\b(no\s+me\s+(escriban|contacten|manden|envíen|llamen)|baja|cancelar\s+suscripción|darme\s+de\s+baja)\b/i,
  /^(stop|baja|cancelar|unsubscribe|detener)$/i,
  /\bno\s+quiero\s+(más\s+)?(mensajes|contacto|notificaciones)\b/i,
];

const HUMAN_REQUEST = [
  /\b(quiero|necesito|quisiera|deseo)\s+(hablar|comunicarme|contactar)\s+(con\s+)?(una?\s+)?(persona|humano|agente|asesor|operador|representante)\b/i,
  /\b(hablar\s+con\s+(una?\s+)?(persona|humano|agente|asesor))\b/i,
  /\b(me\s+comuniques?|comuníqueme)\s+con\s+(una?\s+)?(persona|agente|asesor)\b/i,
  /\b(atiéndame|atiendan|atiéndanos|que\s+me\s+atiendan)\b/i,
  /\b(operador|operadora|asistencia\s+humana|atención\s+humana)\b/i,
  /\bneed\s+(a\s+)?(human|agent|person|representative)\b/i,
];

const SPAM = [
  /\b(gana\s+dinero|trabaja\s+desde\s+casa|inversión\s+(segura|garantizada)|haz\s+clic|clic\s+aquí|enlace\s+exclusivo)\b/i,
  /\b(oferta\s+imperdible|ganaste?\s+un\s+premio|has\s+sido\s+seleccionad[ao])\b/i,
  /https?:\/\/\S+\s+(gana|ganar|dinero|premio|oferta)/i,
];

const GREETING = [
  /^(hola|hi|hello|hey|hola!\s*|good\s+(morning|afternoon|evening))\s*[!.]*$/i,
  /^(buenas?|buenos?\s+(días?|tardes?|noches?))\s*[!.]*$/i,
  /^(qué\s+tal|que\s+tal|cómo\s+estás?|como\s+estas?|saludos)\s*[!.?]*$/i,
];

const COMPLAINT = [
  /\b(queja|reclamo|reclamación|devolución|reembolso|problema\s+con|falla|defecto|roto|dañado)\b/i,
  /\b(pésimo|terrible|fatal|horrible|inaceptable|indignante|decepcionante)\b/i,
  /\b(no\s+funciona|no\s+sirve|no\s+llegó|no\s+recibí|nunca\s+llegó|sigo\s+esperando)\b/i,
  /\b(estoy\s+(enojad[ao]|molest[ao]|frustrad[ao]|hartad[ao]))\b/i,
  /\b(ya\s+pagué\s+y\s+no|pagué\s+pero\s+no)\b/i,
];

const INVOICE = [
  /\b(factura|comprobante|recibo|cfdi|nota\s+de\s+crédito|nota\s+de\s+débito|boleta\s+electrónica|e-invoice)\b/i,
  /\b(necesito\s+(mi\s+)?factura|quiero\s+(la\s+)?factura|envíame?\s+(la\s+)?factura|factura\s+a\s+nombre\s+de)\b/i,
  /\b(datos\s+(fiscales|de\s+facturación)|facturar\s+a\s+mi\s+empresa)\b/i,
];

const PAYMENT = [
  /\b(pagué|ya\s+pagué|realicé\s+el\s+pago|hice\s+la\s+transferencia|comprobante\s+de\s+pago)\b/i,
  /\b(estado\s+de\s+(mi\s+)?pago|cuánto\s+(debo|me\s+deben)|saldo\s+pendiente|cobro|cargo)\b/i,
  /\b(cuándo\s+me\s+cobran|cobró\s+de\s+más|doble\s+cobro|cargo\s+duplicado)\b/i,
];

const PRICE = [
  /\b(cuánto\s+(cuesta|vale|está|cobran)|cuál\s+es\s+el\s+precio|precio\s+de|tarifa|costo\s+de)\b/i,
  /\b(how\s+much\s+(is|does|cost)|what\s+is\s+the\s+price)\b/i,
];

const PRODUCT = [
  /\b(tienen|tienes|hay|venden|vendes)\s+.{2,40}\?/i,
  /\b(información\s+sobre|info\s+de|detalles\s+(de|del|sobre)|características\s+de)\b/i,
  /\b(me\s+gustaría\s+(saber|conocer)|quisiera\s+(saber|información))\b/i,
];

const SALES_LEAD = [
  /\b(estoy\s+interesad[ao]|me\s+interesa|quiero\s+comprar|quisiera\s+adquirir|cotización|presupuesto|propuesta\s+comercial)\b/i,
  /\b(quiero\s+contratar|cómo\s+(compro|adquiero)|disponibilidad\s+para|cuándo\s+pueden\s+enviar)\b/i,
];

const TECHNICAL = [
  /\b(no\s+puedo\s+(acceder|entrar|iniciar\s+sesión|conectar|usar)|error\s+al|falla\s+al|bug|soporte\s+técnico)\b/i,
  /\b(configurar|instalación|manual\s+de\s+usuario|tutorial|cómo\s+usar|no\s+sé\s+cómo)\b/i,
];

@Injectable()
export class IntentClassifierService {
  classify(text: string): { intent: Intent; confidence: "high" | "medium" | "low" } {
    const t = text.trim();

    // Hard-stop rules first (highest priority)
    if (this.test(t, OPT_OUT)) return { intent: "opt_out", confidence: "high" };
    if (this.test(t, HUMAN_REQUEST)) return { intent: "human_request", confidence: "high" };
    if (this.test(t, SPAM)) return { intent: "spam", confidence: "medium" };

    // Pure greeting (short text only)
    if (this.isGreeting(t)) return { intent: "greeting", confidence: "high" };

    // Fiscal / transactional
    if (this.test(t, INVOICE)) return { intent: "invoice_request", confidence: "high" };
    if (this.test(t, PAYMENT)) return { intent: "payment_status", confidence: "high" };

    // Commercial
    if (this.test(t, PRICE)) return { intent: "price_question", confidence: "medium" };
    if (this.test(t, SALES_LEAD)) return { intent: "sales_lead", confidence: "medium" };

    // Service
    if (this.test(t, COMPLAINT)) return { intent: "complaint", confidence: "medium" };
    if (this.test(t, TECHNICAL)) return { intent: "technical_support", confidence: "medium" };
    if (this.test(t, PRODUCT)) return { intent: "product_question", confidence: "low" };

    return { intent: "unknown", confidence: "low" };
  }

  private isGreeting(text: string): boolean {
    return text.split(/\s+/).length <= 6 && this.test(text, GREETING);
  }

  private test(text: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(text));
  }
}
