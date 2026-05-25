# AI response contract hardening patch

This branch was created to fix a production risk in `AiConversationControlService.parseAction()`.

## Problem

When the LLM returns malformed/incomplete JSON like:

```json
{
  "reply_text": "...",
  "interactive": {...},
  "intent_detected":
```

`parseAction()` currently falls through to raw text and sends the entire JSON object to the customer.

## Required code change

In `apps/api/src/ai/ai-conversation-control.service.ts`, replace `parseAction()` with a defensive parser that:

1. Parses strict JSON when valid.
2. If JSON is malformed but contains `reply_text`, extracts only `reply_text`.
3. Never sends raw JSON-looking content to the customer.
4. Uses a safe fallback message when the output contract fails.
5. Logs contract failures for observability.

Suggested replacement:

```ts
  private parseAction(text: string): AiControlAction {
    const raw = text?.trim() ?? "";
    const VALID_INTENTS: AgentIntent[] = ["ORDER", "APPOINTMENT", "QUOTE", "COMPLAINT"];
    const fallbackReply = "Disculpa, tuve un problema preparando la respuesta. ¿Me puedes repetir brevemente qué necesitas?";

    const normalize = (parsed: Record<string, any>): AiControlAction => {
      const replyText = String(parsed.reply_text ?? parsed.text ?? parsed.message ?? parsed.response ?? "").slice(0, 4000);
      const intentRaw = parsed.intent_detected as string | null | undefined;
      const intentDetected: AgentIntent | null =
        intentRaw && VALID_INTENTS.includes(intentRaw as AgentIntent) ? (intentRaw as AgentIntent) : null;

      return {
        reply_text: replyText || fallbackReply,
        interactive: parsed.interactive ?? null,
        memory_updates: parsed.memory_updates ?? null,
        handoff_reason: parsed.handoff_reason ?? null,
        invoice_action: parsed.invoice_action ?? null,
        intent_detected: intentDetected,
      };
    };

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match?.[0] ?? raw);
      if (parsed && typeof parsed === "object") return normalize(parsed);
    } catch {
      // malformed JSON — handled below
    }

    const replyMatch = raw.match(/"reply_text"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (replyMatch?.[1]) {
      try {
        return {
          reply_text: JSON.parse(`"${replyMatch[1]}"`).slice(0, 4000),
          interactive: null,
          memory_updates: null,
          handoff_reason: null,
          invoice_action: null,
          intent_detected: null,
        };
      } catch {
        return {
          reply_text: replyMatch[1].slice(0, 4000),
          interactive: null,
          memory_updates: null,
          handoff_reason: null,
          invoice_action: null,
          intent_detected: null,
        };
      }
    }

    if (/^\s*[\{\[]/.test(raw) || raw.includes('"reply_text"') || raw.includes('"interactive"')) {
      this.logger.warn(`AI_OUTPUT_CONTRACT_FAILED raw=${raw.slice(0, 500)}`);
      return {
        reply_text: fallbackReply,
        interactive: null,
        memory_updates: null,
        handoff_reason: null,
        invoice_action: null,
        intent_detected: null,
      };
    }

    return {
      reply_text: raw.slice(0, 4000) || fallbackReply,
      interactive: null,
      memory_updates: null,
      handoff_reason: null,
      invoice_action: null,
      intent_detected: null,
    };
  }
```

## Prompt hardening required

Also update the system prompt around the JSON contract:

```txt
Contrato interno de salida:
- El JSON es SOLO para PymesHub, nunca para el cliente final.
- El cliente final debe recibir únicamente reply_text o el mensaje interactivo renderizado por el canal.
- No escribas texto antes ni después del JSON.
- Cierra siempre todos los campos. Si un campo no aplica, usa null.
- Si no puedes completar el JSON, responde con un JSON mínimo válido con reply_text, interactive:null, memory_updates:null, handoff_reason:null, invoice_action:null, intent_detected:null.
```

## Master prompt enterprise improvements

The vertical playbook should be expanded to support more business types: restaurants, ecommerce, clinics, beauty, logistics, education, real estate, automotive, professional services, home services, hospitality, nonprofit/community, technology/SaaS, and finance/insurance with escalation guardrails.
