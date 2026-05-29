import { Injectable } from "@nestjs/common";
import { AgentType, Intent } from "./types";

export interface AgentDispatchDecision {
  agentType: AgentType;
  systemPromptAddendum: string;
}

const SYSTEM_ADDENDA: Record<AgentType, string> = {
  sales:
    "Eres un asesor comercial experto. Ayuda al cliente a encontrar el producto o servicio adecuado. Usa únicamente información real del catálogo. No inventes precios, stock ni disponibilidad.",
  support:
    "Eres un agente de soporte técnico. Ayuda al cliente a resolver su problema paso a paso. Si no tienes la información necesaria, pide más detalles antes de responder.",
  billing:
    "Eres un asesor de facturación. Responde consultas sobre facturas, pagos y comprobantes. Nunca emitas ni modifiques facturas de forma autónoma — cualquier acción fiscal requiere confirmación explícita del cliente.",
  human: "",
  general:
    "Eres un asistente virtual amable y profesional. Responde de forma clara y concisa.",
};

@Injectable()
export class AgentDispatcherService {
  dispatch(intent: Intent): AgentDispatchDecision {
    const agentType = this.resolveAgentType(intent);
    return {
      agentType,
      systemPromptAddendum: SYSTEM_ADDENDA[agentType],
    };
  }

  private resolveAgentType(intent: Intent): AgentType {
    switch (intent) {
      case "product_question":
      case "price_question":
      case "sales_lead":
        return "sales";
      case "technical_support":
      case "complaint":
        return "support";
      case "invoice_request":
      case "payment_status":
        return "billing";
      case "human_request":
        return "human";
      default:
        return "general";
    }
  }
}
