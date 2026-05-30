import { Injectable, Logger } from "@nestjs/common";
import { TemplateService } from "./template.service";

const CURATED_TEMPLATES = [
  // ── WhatsApp ──────────────────────────────────────────────────────────────
  {
    key: "wa_bienvenida_cliente",
    name: "bienvenida_cliente",
    description: "Saludo inicial para nuevos clientes",
    type: "message",
    category: "UTILITY",
    channel: "WHATSAPP",
    order: 1,
    body: {
      language: "es",
      body: "Hola {{1}}, bienvenido/a a {{2}}. Estamos aquí para ayudarte con lo que necesites. ¡Con gusto te atendemos!",
      variables: ["nombre_cliente", "nombre_negocio"],
    },
  },
  {
    key: "wa_confirmacion_pedido",
    name: "confirmacion_pedido",
    description: "Confirmación automática al registrar un pedido",
    type: "message",
    category: "UTILITY",
    channel: "WHATSAPP",
    order: 2,
    body: {
      language: "es",
      body: "Hola {{1}}, tu pedido #{{2}} ha sido confirmado. Total: {{3}}. Te avisaremos cuando esté listo.",
      variables: ["nombre_cliente", "numero_pedido", "total"],
    },
  },
  {
    key: "wa_recordatorio_pago",
    name: "recordatorio_pago",
    description: "Recordatorio de factura pendiente de cobro",
    type: "message",
    category: "UTILITY",
    channel: "WHATSAPP",
    order: 3,
    body: {
      language: "es",
      body: "Hola {{1}}, te recordamos que tenés una factura pendiente por {{2}} con vencimiento el {{3}}. Respondé este mensaje para coordinar el pago.",
      variables: ["nombre_cliente", "monto", "fecha_vencimiento"],
    },
  },
  {
    key: "wa_cita_confirmada",
    name: "cita_confirmada",
    description: "Confirmación de cita o reserva",
    type: "message",
    category: "UTILITY",
    channel: "WHATSAPP",
    order: 4,
    body: {
      language: "es",
      body: "Hola {{1}}, tu cita está confirmada para el {{2}} a las {{3}}. Si necesitás reagendar, respondé este mensaje.",
      variables: ["nombre_cliente", "fecha", "hora"],
    },
  },
  {
    key: "wa_notificacion_envio",
    name: "pedido_en_camino",
    description: "Notificación de despacho de pedido",
    type: "message",
    category: "UTILITY",
    channel: "WHATSAPP",
    order: 5,
    body: {
      language: "es",
      body: "Hola {{1}}, tu pedido #{{2}} ya fue despachado. Tiempo estimado de entrega: {{3}}. ¡Gracias por tu compra!",
      variables: ["nombre_cliente", "numero_pedido", "tiempo_entrega"],
    },
  },
  {
    key: "wa_seguimiento_cotizacion",
    name: "seguimiento_cotizacion",
    description: "Seguimiento de cotización enviada al cliente",
    type: "message",
    category: "MARKETING",
    channel: "WHATSAPP",
    order: 6,
    body: {
      language: "es",
      body: "Hola {{1}}, vemos que revisaste nuestra cotización para {{2}}. ¿Tenés alguna pregunta? Con gusto te la resolvemos.",
      variables: ["nombre_cliente", "descripcion_producto"],
    },
  },
  {
    key: "wa_solicitud_resena",
    name: "solicitud_resena",
    description: "Solicita reseña o valoración al cliente",
    type: "message",
    category: "MARKETING",
    channel: "WHATSAPP",
    order: 7,
    body: {
      language: "es",
      body: "Hola {{1}}, esperamos que estés satisfecho/a con tu compra en {{2}}. ¿Podrías dejarnos tu opinión? Tu experiencia nos ayuda a mejorar.",
      variables: ["nombre_cliente", "nombre_negocio"],
    },
  },
  {
    key: "wa_reactivacion_cliente",
    name: "reactivacion_cliente",
    description: "Reactivación de clientes inactivos",
    type: "message",
    category: "MARKETING",
    channel: "WHATSAPP",
    order: 8,
    body: {
      language: "es",
      body: "Hola {{1}}, hace tiempo que no sabemos de vos. Tenemos novedades en {{2}} que te pueden interesar. ¡Escribinos cuando quieras!",
      variables: ["nombre_cliente", "nombre_negocio"],
    },
  },

  // ── Telegram ──────────────────────────────────────────────────────────────
  {
    key: "tg_bienvenida_bot",
    name: "Bienvenida al bot",
    description: "Mensaje de bienvenida cuando alguien inicia el bot",
    type: "message",
    category: "SERVICE",
    channel: "TELEGRAM",
    order: 10,
    body: {
      language: "es",
      body: "¡Hola! Bienvenido/a a {{nombre_negocio}}. Estamos aquí para ayudarte. ¿En qué podemos asistirte hoy?",
      variables: ["nombre_negocio"],
    },
  },
  {
    key: "tg_info_horario",
    name: "Horario de atención",
    description: "Informa el horario de atención al cliente",
    type: "message",
    category: "SERVICE",
    channel: "TELEGRAM",
    order: 11,
    body: {
      language: "es",
      body: "Nuestro horario de atención es:\n• Lunes a viernes: {{horario_lv}}\n• Sábados: {{horario_sab}}\n• Domingos: Cerrado\n\nFuera de horario dejá tu mensaje y te respondemos a primera hora.",
      variables: ["horario_lv", "horario_sab"],
    },
  },
  {
    key: "tg_menu_servicios",
    name: "Menú de servicios",
    description: "Menú inicial de opciones para el cliente",
    type: "message",
    category: "SERVICE",
    channel: "TELEGRAM",
    order: 12,
    body: {
      language: "es",
      body: "¿En qué te podemos ayudar?\n\n1. Consultar pedido\n2. Soporte técnico\n3. Solicitar cotización\n4. Información de precios\n5. Hablar con un agente\n\nEscribí el número o describí tu consulta.",
      variables: [],
    },
  },
];

@Injectable()
export class MessageTemplatesSeed {
  private readonly logger = new Logger(MessageTemplatesSeed.name);

  constructor(private readonly templateService: TemplateService) {}

  async seed(): Promise<void> {
    try {
      for (const tpl of CURATED_TEMPLATES) {
        await this.templateService.upsertSystemTemplate(tpl);
      }
      this.logger.log(`[message-templates-seed] ${CURATED_TEMPLATES.length} templates upserted`);
    } catch (err: unknown) {
      this.logger.warn(
        `[message-templates-seed] seed failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
