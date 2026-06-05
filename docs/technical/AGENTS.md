# PymesHub AI Agents — Technical Reference

## Limits and Constraints

### LLM call limits (CloudflareAiService)
- **Timeout:** 15 seconds (AbortSignal, hard limit)
- **Max output tokens:** 500 tokens per completion
- **Temperature:** 0.3 (deterministic-leaning for business context)

If a call exceeds 15s, the AbortController fires and the error propagates to the caller. The caller (message router, intent classifier) catches and falls back to a safe default (intent=unknown, or skips AI reply).

### Flowise call limits (FlowiseClient)
- **Timeout:** `FLOWISE_TIMEOUT_MS` env var (default: 90 seconds)
- **Health check:** every 30 seconds via `FlowiseHealthService`
- **DEGRADED threshold:** 3 consecutive ping failures → Flowise dispatch is skipped, no AI reply sent

### Intent classification limits (LlmIntentClassifierService)
- **Max completion tokens:** 500 (includes reasoning for MiMo thinking models)
- **LLM timeout:** 3 seconds
- **Input truncation:** customer message truncated to 500 chars before classification

### FAQ cache (RedisCacheService)
- **Key pattern:** `cache:faq:{workspaceId}:{sha256(query)[0:16]}`
- **TTL:** 7 days (604,800 seconds)
- **Cacheable:** questions < 150 chars, no contextEnrichment, not forced
- **Invalidation:** `RedisCacheService.invalidateFaqCache(workspaceId)` on KB update

---

## Token Quota per Plan

| Plan | Monthly token ceiling |
|---|---|
| FREE | 0 (AI disabled) |
| EMPRENDE | 100,000 |
| STARTER | 50,000 |
| GROWTH | 500,000 |
| BUSINESS | 2,000,000 |
| ENTERPRISE | 2,000,000 |
| BUSINESS_PLUS | Custom |

Token usage is tracked in `ai_token_transactions` (type=CONSUMPTION). The `PlanLimitsService.enforceAiTokenLimit(workspaceId)` method hard-blocks AI calls when the monthly ceiling is reached, returning a `QuotaExceededError` (HTTP 403).

Usage is visible to ADMIN/OWNER at `GET /api/workspaces/current/ai-usage`.

---

## Flowise Health Check

`FlowiseHealthService` pings `FLOWISE_BASE_URL/api/v1/ping` every 30 seconds.

- 3 consecutive failures → status = `DEGRADED`
- `FlowiseAutoReplyService.dispatch()` returns `false` immediately when DEGRADED (no AI reply sent)
- The human handoff flow proceeds normally
- Status resets to `HEALTHY` on the first successful ping after DEGRADED

Health report: `FlowiseHealthService.getHealthReport()` returns `{ status, consecutiveFailures, lastCheckedAt }`.

---

## Security Notes

- All inbound customer text passes through `AgentGuardrailsService.detectPromptInjectionAttempt()` before reaching Flowise
- Detected injection → conversation escalated to REQUIRES_HUMAN, audit log created, fallback message sent
- Flowise calls use AbortSignal — cannot hang indefinitely
- FAQ cache responses are served as-is — only trusted Flowise-generated content is cached
