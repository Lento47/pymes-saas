# PymesHub — Runbook de Recuperación ante Desastres

**Versión:** 1.0  
**Propietario:** Tech Lead  
**Revisión:** Semestral o tras cada incidente mayor  
**Contactos de guardia:** ver sección 9

---

## 1. Clasificación de incidentes

| Severidad | Criterio | Tiempo máx. de respuesta inicial |
|---|---|---|
| **SEV-1** | Servicio completamente inaccesible para todos los clientes | 15 min |
| **SEV-2** | Degradación grave (>50% de workspaces afectados, pérdida de datos, seguridad) | 30 min |
| **SEV-3** | Funcionalidad específica rota, impacto parcial | 2 horas |
| **SEV-4** | Bug menor, sin pérdida de datos ni impacto en core | Siguiente hábil |

---

## 2. Objetivos de recuperación por plan

| Plan | RTO objetivo | RPO máximo | Replica de solo lectura |
|---|---|---|---|
| FREE | 4 horas | 24 horas | No |
| EMPRENDE | 2 horas | 8 horas | No |
| STARTER | 1 hora | 4 horas | No |
| GROWTH | 30 min | 1 hora | Sí (lectura) |
| BUSINESS | 15 min | 15 min | Sí (failover automático) |
| BUSINESS_PLUS | 10 min | 5 min | Sí (failover automático) |

**RTO** = Recovery Time Objective (tiempo hasta restaurar el servicio)  
**RPO** = Recovery Point Objective (pérdida máxima de datos aceptable)

---

## 3. Árbol de decisión — primer respondedor

```
¿La API responde en /health?
├─ NO → Ir a §4 (API caída)
└─ SÍ
    ├─ ¿Errores 5xx masivos en Sentry/Slack? → Ir a §5 (degradación de servicio)
    ├─ ¿Alertas de DB (conexiones agotadas, disk full)? → Ir a §6 (base de datos)
    ├─ ¿Workers de BullMQ detenidos? → Ir a §7 (workers)
    └─ ¿Problema de canal (WhatsApp/Telegram)? → Ir a §8 (canales)
```

---

## 4. Procedimiento: API completamente caída

### 4.1 Diagnóstico rápido

```bash
# Estado Railway / proveedor de hosting
# Verificar en Railway dashboard → Deployments

# Logs recientes
railway logs --tail 100 | grep -E "ERROR|FATAL|crash"

# Verificar variables de entorno críticas
railway variables list | grep -E "DATABASE_URL|JWT_SECRET|REDIS"
```

### 4.2 Reinicio de emergencia

```bash
# Forzar redeploy del último build exitoso en Railway
railway up --detach

# O redeploy desde GitHub Actions si el pipeline está verde
git tag emergency-restart-$(date +%Y%m%d%H%M) HEAD
git push origin --tags
```

### 4.3 Si el reinicio no funciona

1. Verificar que `DATABASE_URL` apunte a la instancia correcta
2. Verificar que Redis esté accesible (`REDIS_URL`)
3. Si falla el startup por variable faltante → revisar la lista en `main.ts:REQUIRED_ENV_VARS`
4. Si la DB está caída → ir a §6

**Criterio de escalada:** Si no hay servicio tras 2 intentos de reinicio → escalar a Tech Lead + notificar clientes afectados

---

## 5. Procedimiento: Degradación de servicio (5xx masivos)

### 5.1 Identificar la causa

```bash
# Últimos errores desde Slack alerts o Sentry
# Buscar patrón en error_code devuelto por la API:
# WHATSAPP_CONFIG, BILLING_FAILURE, SCHEMA_MISMATCH, QUEUE_FAILURE, etc.

# Query de diagnóstico en DB
psql $DATABASE_URL -c "
  SELECT error_code, COUNT(*) as n, MAX(created_at) as last_seen
  FROM support_diagnostic_cases
  WHERE created_at > NOW() - INTERVAL '2 hours'
  GROUP BY error_code ORDER BY n DESC LIMIT 10;
"
```

### 5.2 Rollback de despliegue

```bash
# Listar deployments recientes en Railway
# Hacer rollback al anterior desde Railway dashboard → Deployments → Rollback
```

### 5.3 Mitigación temporal

- Si el problema es un worker específico: deshabilitar el procesador del queue afectado
- Si es una integración externa (WhatsApp API): activar modo manual en canales afectados

---

## 6. Procedimiento: Problemas de base de datos

### 6.1 Conexiones agotadas

```bash
psql $DATABASE_URL -c "
  SELECT count(*), state, wait_event_type, wait_event
  FROM pg_stat_activity GROUP BY state, wait_event_type, wait_event;
"

# Terminar conexiones idle:
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';
"
```

### 6.2 Disco lleno

```bash
# Verificar tamaño de tablas
psql $DATABASE_URL -c "
  SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) as size
  FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 15;
"

# Limpiar audit_logs si es necesario (emergencia)
psql $DATABASE_URL -c "
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  VACUUM ANALYZE audit_logs;
"
```

### 6.3 Restauración completa desde backup

> **CRÍTICO:** Esta operación elimina todos los datos actuales.

```bash
# 1. Obtener el último backup disponible en S3
aws s3 ls s3://$STORAGE_BUCKET/backups/ --endpoint-url $STORAGE_ENDPOINT | sort | tail -5

# 2. Ejecutar el script de restauración
chmod +x scripts/restore-backup.sh
./scripts/restore-backup.sh s3://$STORAGE_BUCKET/backups/<backup-file>.sql.gz

# 3. Reiniciar la API (limpia los connection pools de Prisma)
railway up --detach

# 4. Verificar estado
curl https://api.pymeshub.lat/health
```

### 6.4 Failover a réplica de solo lectura (GROWTH+)

```bash
# Cambiar DATABASE_URL a la réplica en Railway:
railway variables set DATABASE_URL="postgres://user:pass@replica-host:5432/dbname"
railway up --detach

# NOTA: En modo réplica solo funcionan operaciones de lectura.
# Los writes fallarán — informar a los clientes que el modo es solo lectura.
```

---

## 7. Procedimiento: Workers BullMQ detenidos

```bash
# Verificar estado de queues en Redis
redis-cli -u $REDIS_URL info server | grep redis_version
redis-cli -u $REDIS_URL keys "bull:*:failed" | head -20

# Si Redis está caído → los workers se reconectarán solos cuando Redis vuelva
# Si Redis está OK pero los workers no procesan:
#   1. Reiniciar el API (los workers son parte del mismo proceso en NestJS)
#   2. Verificar que BullMQ no tenga jobs en estado "stalled"

redis-cli -u $REDIS_URL eval "
  local keys = redis.call('keys', 'bull:*:stalled')
  for i,k in ipairs(keys) do redis.call('del',k) end
  return #keys
" 0
```

---

## 8. Procedimiento: Canales de mensajería caídos

### WhatsApp (Meta)

1. Verificar estado en [Meta Status](https://metastatus.com)
2. Si el webhook de verificación falla: regenerar token en Meta for Developers → reconfigurar URL
3. Si la API de envíos falla: los mensajes quedan en cola BullMQ y se reintentan automáticamente

### Telegram

1. Verificar [Telegram API status](https://core.telegram.org/api)
2. Si el bot no responde: `GET https://api.telegram.org/bot{TOKEN}/getMe`
3. Reiniciar el webhook: `POST https://api.telegram.org/bot{TOKEN}/setWebhook`

---

## 9. Contactos de guardia (on-call)

| Rol | Nombre | Método de contacto |
|---|---|---|
| Tech Lead (primario) | — | Completar antes del lanzamiento |
| Backend (secundario) | — | Completar antes del lanzamiento |
| DevOps | — | Completar antes del lanzamiento |
| CEO / Decisor | — | Completar antes del lanzamiento |

---

## 10. Post-mortem

Todo incidente SEV-1 o SEV-2 requiere un post-mortem dentro de las 48 horas de resolución:

1. **Timeline** — cronología exacta del incidente (detección → resolución)
2. **Causa raíz** — análisis de 5 porqués
3. **Impacto** — workspaces afectados, duración, datos en riesgo
4. **Acciones correctivas** — con responsable y fecha límite
5. **Comunicación a clientes** — qué se comunicó y cuándo

Template: `docs/operations/templates/post-mortem-template.md`

---

*Última revisión: 2026-06-05*
