import { Injectable } from "@nestjs/common";
import { ChannelType, Intent } from "./types";

const REPLIES: Partial<Record<Intent, string>> = {
  greeting: "¡Hola! ¿En qué te puedo ayudar hoy?",
  human_request:
    "Entendido. Te estoy conectando con un agente. En un momento alguien te atenderá.",
  opt_out:
    "Hemos registrado tu solicitud. No te enviaremos más mensajes. Si necesitas ayuda en el futuro, escríbenos aquí.",
};

@Injectable()
export class QuickReplyService {
  /**
   * Returns a pre-canned Spanish reply for deterministic intents, or null
   * if the intent should be handled by the AI chain.
   */
  getQuickReply(intent: Intent, _channel: ChannelType): string | null {
    return REPLIES[intent] ?? null;
  }
}
