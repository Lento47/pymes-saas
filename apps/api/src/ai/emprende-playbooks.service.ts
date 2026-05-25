import { Injectable } from "@nestjs/common";

export type EmprendeIntent =
  | "sales_quote"
  | "support_faq"
  | "booking"
  | "order_status"
  | "payment_reported"
  | "human_handoff"
  | "off_topic";

export interface EmprendePlaybookInput {
  businessName: string;
  message: string;
  planKey: string;
}

export interface EmprendePlaybookOutput {
  playbookVersion: string;
  intent: EmprendeIntent;
  reply: string;
  requiredFields: string[];
  escalationRequired: boolean;
  capabilityTier: "BASIC" | "PRO" | "ADVANCED" | "CUSTOM";
  allowedActions: string[];
  forbiddenActions: string[];
}

@Injectable()
export class EmprendePlaybooksService {
  static readonly PLAYBOOK_VERSION = "v1.1.0";

  run(input: EmprendePlaybookInput): EmprendePlaybookOutput {
    const intent = this.detectIntent(input.message);
    const tier = this.resolveCapabilityTier(input.planKey);
    const capabilities = this.buildCapabilities(intent, tier);

    switch (intent) {
      case "sales_quote":
        return {
          playbookVersion: EmprendePlaybooksService.PLAYBOOK_VERSION,
          intent,
          reply:
            "¡Con gusto! Te ayudo con la cotización. Para darte una opción precisa, cuéntame qué necesitas y para cuándo lo ocupas.",
          requiredFields: capabilities.requiredFields,
          escalationRequired: capabilities.escalationRequired,
          capabilityTier: tier,
          allowedActions: capabilities.allowedActions,
          forbiddenActions: capabilities.forbiddenActions,
        };
      case "support_faq":
        return {
          playbookVersion: EmprendePlaybooksService.PLAYBOOK_VERSION,
          intent,
          reply:
            "Claro, te ayudo. Si no tengo el dato exacto aquí, lo escalo al equipo para confirmarte por este mismo medio.",
          requiredFields: capabilities.requiredFields,
          escalationRequired: capabilities.escalationRequired,
          capabilityTier: tier,
          allowedActions: capabilities.allowedActions,
          forbiddenActions: capabilities.forbiddenActions,
        };
      case "booking":
        return {
          playbookVersion: EmprendePlaybooksService.PLAYBOOK_VERSION,
          intent,
          reply:
            "Perfecto, te apoyo con la reserva. ¿Qué fecha, hora y servicio necesitas?",
          requiredFields: capabilities.requiredFields,
          escalationRequired: capabilities.escalationRequired,
          capabilityTier: tier,
          allowedActions: capabilities.allowedActions,
          forbiddenActions: capabilities.forbiddenActions,
        };
      case "order_status":
        return {
          playbookVersion: EmprendePlaybooksService.PLAYBOOK_VERSION,
          intent,
          reply:
            "Te ayudo a revisar el estado de tu pedido. Compárteme el número de orden o el nombre con el que lo realizaste.",
          requiredFields: capabilities.requiredFields,
          escalationRequired: capabilities.escalationRequired,
          capabilityTier: tier,
          allowedActions: capabilities.allowedActions,
          forbiddenActions: capabilities.forbiddenActions,
        };
      case "payment_reported":
        return {
          playbookVersion: EmprendePlaybooksService.PLAYBOOK_VERSION,
          intent,
          reply:
            "Perfecto, gracias. Puedes enviar el comprobante por aquí y lo registro para validación del equipo.",
          requiredFields: capabilities.requiredFields,
          escalationRequired: capabilities.escalationRequired,
          capabilityTier: tier,
          allowedActions: capabilities.allowedActions,
          forbiddenActions: capabilities.forbiddenActions,
        };
      case "human_handoff":
        return {
          playbookVersion: EmprendePlaybooksService.PLAYBOOK_VERSION,
          intent,
          reply:
            "Con gusto. Te paso con el equipo para que te atiendan por este mismo medio lo antes posible.",
          requiredFields: capabilities.requiredFields,
          escalationRequired: capabilities.escalationRequired,
          capabilityTier: tier,
          allowedActions: capabilities.allowedActions,
          forbiddenActions: capabilities.forbiddenActions,
        };
      case "off_topic":
      default:
        return {
          playbookVersion: EmprendePlaybooksService.PLAYBOOK_VERSION,
          intent: "off_topic",
          reply: `¡Buena pregunta! También puedo conversar de eso brevemente, y además estoy para ayudarte con ${input.businessName}. Si quieres, te apoyo con ventas, soporte, pedidos, pagos o agenda. ¿Qué te gustaría resolver ahora?`,
          requiredFields: capabilities.requiredFields,
          escalationRequired: capabilities.escalationRequired,
          capabilityTier: tier,
          allowedActions: capabilities.allowedActions,
          forbiddenActions: capabilities.forbiddenActions,
        };
    }
  }

  private resolveCapabilityTier(planKey: string): "BASIC" | "PRO" | "ADVANCED" | "CUSTOM" {
    if (planKey === "BUSINESS_PLUS") return "CUSTOM";
    if (planKey === "BUSINESS" || planKey === "ENTERPRISE") return "ADVANCED";
    if (planKey === "GROWTH") return "PRO";
    return "BASIC";
  }

  private buildCapabilities(
    intent: EmprendeIntent,
    tier: "BASIC" | "PRO" | "ADVANCED" | "CUSTOM",
  ): Pick<
    EmprendePlaybookOutput,
    "requiredFields" | "escalationRequired" | "allowedActions" | "forbiddenActions"
  > {
    const baseForbidden = [
      "invent_prices",
      "promise_unconfigured_discount",
      "confirm_payment_without_verification",
      "share_data_between_tenants",
      "provide_tax_or_legal_advice",
    ];

    const requiredByIntent: Record<EmprendeIntent, string[]> = {
      sales_quote: ["need", "target_date"],
      support_faq: ["question_context"],
      booking: ["service", "date", "time", "customer_name"],
      order_status: ["order_reference_or_name"],
      payment_reported: ["payment_method", "proof"],
      human_handoff: ["reason"],
      off_topic: [],
    };

    const proExtras: Record<EmprendeIntent, string[]> = {
      sales_quote: ["zone_or_budget"],
      support_faq: ["preferred_channel"],
      booking: ["location"],
      order_status: ["delivery_method"],
      payment_reported: ["order_reference"],
      human_handoff: ["urgency"],
      off_topic: [],
    };

    const advancedExtras: Record<EmprendeIntent, string[]> = {
      sales_quote: ["lead_source", "purchase_readiness"],
      support_faq: ["policy_reference"],
      booking: ["reschedule_window", "special_requirements"],
      order_status: ["sla_window", "incident_tag"],
      payment_reported: ["amount", "payment_timestamp"],
      human_handoff: ["owner_team", "handoff_summary"],
      off_topic: [],
    };

    const actionsByTier: Record<typeof tier, string[]> = {
      BASIC: ["intent_classification", "collect_missing_fields", "human_handoff"],
      PRO: ["intent_classification", "collect_missing_fields", "human_handoff", "followup_suggestion"],
      ADVANCED: [
        "intent_classification",
        "collect_missing_fields",
        "human_handoff",
        "followup_suggestion",
        "priority_tagging",
        "ticket_payload_enrichment",
      ],
      CUSTOM: [
        "intent_classification",
        "collect_missing_fields",
        "human_handoff",
        "followup_suggestion",
        "priority_tagging",
        "ticket_payload_enrichment",
        "custom_workflow_hooks",
      ],
    };

    const requiredFields = [...requiredByIntent[intent]];
    if (tier !== "BASIC") requiredFields.push(...proExtras[intent]);
    if (tier === "ADVANCED" || tier === "CUSTOM") requiredFields.push(...advancedExtras[intent]);

    const escalationRequired = intent === "payment_reported" || intent === "human_handoff";

    return {
      requiredFields,
      escalationRequired,
      allowedActions: actionsByTier[tier],
      forbiddenActions: baseForbidden,
    };
  }

  private detectIntent(message: string): EmprendeIntent {
    const normalized = message.toLowerCase();

    if (this.hasAny(normalized, ["humano", "asesor", "agente", "persona", "hablar con alguien"])) {
      return "human_handoff";
    }

    if (this.hasAny(normalized, ["sinpe", "ya pag", "transfer", "comprobante", "pago"])) {
      return "payment_reported";
    }

    if (this.hasAny(normalized, ["pedido", "orden", "envío", "entrega", "tracking"])) {
      return "order_status";
    }

    if (this.hasAny(normalized, ["cita", "agenda", "reserv", "hora", "disponibilidad"])) {
      return "booking";
    }

    if (this.hasAny(normalized, ["precio", "cotiz", "cuánto cuesta", "servicio", "producto"])) {
      return "sales_quote";
    }

    if (this.hasAny(normalized, ["horario", "ubicación", "garantía", "cambio", "devolución", "método de pago"])) {
      return "support_faq";
    }

    return "off_topic";
  }

  private hasAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term));
  }
}
