# PymesHub — Pre-Launch Sprints

**Horizonte:** 12 semanas → Beta cerrada  
**Cadencia:** Sprints de 2 semanas  
**Criterio de priorización:** riesgo de bloqueo legal/técnico > dependencias > impacto en usuario

---

## Sprint 1 — Semanas 1-2 · Seguridad baseline

> Fundamento mínimo antes de exponer la plataforma a clientes reales.

| # | Ítem | Responsable | Notas |
|---|------|-------------|-------|
| 1.2 | Rate limiting por IP y por workspace (`@nestjs/throttler` + Redis) | Tech Lead | Prioridad máxima — sin esto cualquier bot puede tirar la API |
| 1.6 | Tabla `audit_logs` + panel Settings > Audit Logs (OWNER/ADMIN) | Backend + Frontend | Requisito de compliance desde día 1 |
| 1.1 | **Iniciar** auditoría de seguridad externa (contactar proveedor, enviar briefing) | Tech Lead | No bloquea el sprint; el informe llega en Sprint 5 |

**Criterio de salida:** Rate limiting respondiendo 429 con `Retry-After`. Panel de audit logs visible para admins. Proveedor de pentest contratado.

---

## Sprint 2 — Semanas 3-4 · Compliance y monitorización

> Cumplimiento legal CR y visibilidad operativa antes de manejar datos reales.

| # | Ítem | Responsable | Notas |
|---|------|-------------|-------|
| 2.4 | Sentry (API + web) + Uptime Robot + alertas a Slack | DevOps | Setup rápido (~2 días), impacto inmediato en visibilidad |
| 1.3 | Política de retención (Ley 8968) + job BullMQ diario de purga | Backend + Legal | Job corre a las 02:00 UTC; tabla `deleted_logs` sin PII |
| 1.4 | Endpoint `POST /api/workspaces/:id/export` → ZIP firmado en S3 | Backend | Límite 1 exportación/24h; notificación vía email + campana |

**Criterio de salida:** Alertas disparándose en Slack ante errores 5xx. Job de retención correra en staging. Export genera ZIP en < 5 min con workspace de prueba.

---

## Sprint 3 — Semanas 5-6 · Infraestructura y operaciones

> Capacidad de recuperarse ante desastres antes de tener clientes de pago.

| # | Ítem | Responsable | Notas |
|---|------|-------------|-------|
| 2.2 | `pg_dump` diario → MinIO/S3 + script `restore-backup.sh` probado | DevOps | Retener 30 días; reporte de validación a Slack |
| 2.6 | Runbook `docs/operations/disaster-recovery.md` | DevOps + Tech Lead | Pasos exactos, responsables, teléfonos on-call |
| 2.3 | Documento RTO/RPO por plan + test de conmutación a réplica | DevOps | Réplica de solo lectura como base del RPO < 15 min |
| 2.1 | Benchmarks de capacidad con k6/artillery (webhooks, BullMQ) | Backend | Documentar límites claros: "X workspaces activos por instancia" |
| 2.5 | Documento SLA por plan + medidor de uptime real (3 regiones) | Tech Lead + Legal | Publicar en `/legal/sla` y en página de planes |

**Criterio de salida:** Restauración completa ejecutada y app funcionando desde backup. Runbook revisado por todo el equipo.

---

## Sprint 4 — Semanas 7-8 · Agentes IA production-ready

> Los agentes IA deben ser predecibles en costo, latencia y resiliencia.

| # | Ítem | Responsable | Notas |
|---|------|-------------|-------|
| 4.1 | Límites de tokens por plan en `PlanLimitsService` + dashboard de uso | AI Engineer + Backend | Bloqueo con mensaje claro al superar límite |
| 4.3 | Health check cada 30s a Flowise + fallback a mensaje estático | Backend | Si falla 3 veces → DEGRADED, crear tarea para soporte |
| 4.4 | Timeout 15s en llamadas a LLM + max 500 tokens de salida + cancelación | Backend | Documentar en `AGENTS.md` |
| 4.2 | Caché Redis para preguntas frecuentes (`cache:faq:{wsId}:{hash}`, TTL 7d) | Backend | Objetivo: ≥ 30% de consultas servidas desde caché |

**Criterio de salida:** Simular caída de Flowise → inbox sigue recibiendo mensajes con fallback. Dashboard de tokens visible para OWNER.

---

## Sprint 5 — Semanas 9-10 · Facturación electrónica (Hacienda CR)

> Integración completa y probada antes de ofrecer facturación a clientes.

| # | Ítem | Responsable | Notas |
|---|------|-------------|-------|
| 3.4 | `hacienda-queue` BullMQ (10 intentos, backoff exponencial, dead-letter) | Backend | Base de todos los demás ítems de facturación |
| 3.1 | Validación en ambiente de contingencia de Hacienda + `pnpm test:hacienda` | Backend + Integraciones | Todos los flujos: FE, NC, exportación, ack |
| 3.2 | Certificado .p12 encriptado en DB + job de alerta de expiración (30/15/7/1d) | Backend | Wizard de renovación con reemplazo atómico |
| 3.3 | Suite de pruebas: NC, contingencia (timeout Hacienda), plazos 8 días | Backend | Usar BullMQ para reintentos en contingencia |
| 3.5 | Generación PDF + XML firmado → ZIP → envío por WhatsApp/Email | Backend + Frontend | Almacenar en MinIO bajo `invoices/{wsId}/{invoiceId}` |
| 1.1 | **Recibir** informe de auditoría externa + iniciar remediación | Tech Lead | Vulnerabilidades críticas/altas deben resolverse antes de Sprint 6 |

**Criterio de salida:** `pnpm test:hacienda` pasa con "Aceptado" en todos los casos. Certificado vencido → sistema rechaza emisiones y guía al usuario.

---

## Sprint 6 — Semanas 11-12 · Calidad, encriptación y lanzamiento

> Última milla: pruebas E2E, encriptación de datos sensibles y documentación.

| # | Ítem | Responsable | Notas |
|---|------|-------------|-------|
| 5.1 | Suite E2E con Playwright (10 flujos críticos) en CI/GitHub Actions | QA + Backend | Bloquea merge a master si algún E2E falla |
| 5.2 | Webhook retry queue (BullMQ, maxRetries=5) + job de reconciliación diaria | Backend | Dashboard de "estado de sincronización" para admins |
| 1.5 | AES-256-GCM en reposo via Prisma middleware + rotación de clave (`ENCRYPTION_KEY_VERSION`) | Tech Lead | Verificar en DB que campos sensibles son binario ilegible |
| 1.1 | **Cerrar** remediaciones del pentest (vulnerabilidades críticas/altas) | Tech Lead | Criterio: informe sin críticas ni altas |
| 5.3 | Centro de ayuda: vídeos cortos + artículos paso a paso + FAQ + chatbot de ayuda | Frontend + Contenido | Meta: integración de WhatsApp en < 10 min sin ticket |

**Criterio de salida:** Pipeline CI verde con E2E. Informe de pentest sin críticas. Un usuario nuevo puede integrarse sin soporte.

---

## Resumen de hitos

| Semana | Hito |
|--------|------|
| 2 | Rate limiting activo + audit logs + pentest iniciado |
| 4 | Monitorización real + compliance de datos CR |
| 6 | Backups probados + runbook operativo |
| 8 | Agentes IA estables en costo y resiliencia |
| 10 | Facturación electrónica validada con Hacienda |
| 12 | **Beta cerrada lista** — E2E verde, encriptación activa, pentest cerrado |

---

## Ítems fuera de sprints (paralelos o continuos)

| Ítem | Modalidad |
|------|-----------|
| 5.3 Documentación de usuario | Continuo desde Sprint 3; no bloquea lanzamiento pero sí la adopción |
| 2.5 Medidor de uptime real | Se activa al configurar Uptime Robot en Sprint 2; los reportes son mensuales |
| 1.1 Auditoría externa | Proceso externo: inicia Sprint 1, informe Sprint 5, cierre Sprint 6 |
