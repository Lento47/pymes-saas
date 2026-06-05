# PymesHub — Acuerdo de Nivel de Servicio (SLA)

**Versión:** 2.0  
**Vigente:** 2026-06-05  
**Propietario:** Tech Lead + Legal

---

## 1. Propósito

Este documento define los objetivos de disponibilidad y recuperación de PymesHub por plan de suscripción. A menos de un acuerdo enterprise explícito por escrito, estos valores son objetivos operativos y no constituyen compromisos indemnizables con créditos automáticos.

---

## 2. Disponibilidad objetivo por plan

| Plan | Disponibilidad mensual objetivo | Tiempo de inactividad permitido / mes |
|---|---|---|
| FREE | 99.0% | ~7.2 horas |
| EMPRENDE | 99.5% | ~3.6 horas |
| STARTER | 99.5% | ~3.6 horas |
| GROWTH | 99.9% | ~43 minutos |
| BUSINESS | 99.95% | ~22 minutos |
| BUSINESS_PLUS | 99.99% | ~4.4 minutos |

**Medición:** uptime calculado mensualmente con datos de Uptime Robot (3 regiones: US-East, EU-West, SA-East). Los períodos de mantenimiento programado y comunicado no cuentan como inactividad.

---

## 3. RTO y RPO por plan

| Plan | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) | Replica de solo lectura |
|---|---|---|---|
| FREE | 4 horas | 24 horas | No |
| EMPRENDE | 2 horas | 8 horas | No |
| STARTER | 1 hora | 4 horas | No |
| GROWTH | 30 minutos | 1 hora | Sí |
| BUSINESS | 15 minutos | 15 minutos | Sí + failover |
| BUSINESS_PLUS | 10 minutos | 5 minutos | Sí + failover |

**RTO:** tiempo máximo para restaurar el servicio tras un fallo.  
**RPO:** pérdida máxima de datos aceptable (desde el último punto de restauración).

**Backups:** `pg_dump` diario a las 02:30 UTC → S3/MinIO con retención de 30 días. Los planes GROWTH+ tienen réplica de solo lectura disponible para failover manual.

---

## 4. Mantenimiento programado

- Se anuncia con mínimo **72 horas** de anticipación (excepto emergencias de seguridad).
- Ventana preferida: **martes o miércoles, 02:00–04:00 UTC**.
- Canal de comunicación: estado en `status.pymeshub.lat` + email a admins de workspace.
- Los mantenimientos no cuentan como tiempo de inactividad si se comunican con anticipación.

---

## 5. Niveles de soporte por plan

| Plan | Canal | Tiempo de primera respuesta | Horario |
|---|---|---|---|
| FREE | Chat in-app | 48 horas (días hábiles) | Lu–Vi |
| EMPRENDE | Chat in-app | 24 horas | Lu–Vi |
| STARTER | Chat + email | 8 horas | Lu–Vi |
| GROWTH | Chat + email | 4 horas | Lu–Vi |
| BUSINESS | Chat + email + ticket prioritario | 2 horas | Lu–Sa |
| BUSINESS_PLUS | Chat + email + ticket prioritario + llamada | 1 hora | 24/7 |

---

## 6. Exclusiones

Este SLA no aplica cuando la inactividad se debe a:

- Internet o infraestructura del cliente
- Fuerza mayor (terremotos, cortes generalizados)
- Ataques DDoS volumétricos que superen la capacidad de mitigación razonable
- Configuraciones erróneas realizadas por el cliente
- Uso contrario a los Términos de Servicio
- Fallas en servicios de terceros fuera de nuestro control (Meta API, Telegram API, proveedores de email)
- Mantenimientos programados y comunicados

---

## 7. Créditos de servicio (planes enterprise, por acuerdo expreso)

Para clientes con contrato enterprise, si la disponibilidad mensual medida cae por debajo del objetivo:

| Incumplimiento | Crédito |
|---|---|
| Disponibilidad entre objetivo y objetivo – 1% | 10% del pago mensual |
| Disponibilidad entre objetivo – 1% y objetivo – 5% | 25% del pago mensual |
| Disponibilidad < objetivo – 5% | 50% del pago mensual |

Los créditos se solicitan dentro de los 15 días del mes siguiente. Los créditos no son acumulables con otros descuentos y no son transferibles a efectivo.

---

## 8. Medición de disponibilidad

- **Herramienta:** Uptime Robot (3 monitores: US-East, EU-West, SA-East)
- **Endpoint monitoreado:** `GET /health`
- **Frecuencia:** cada 1 minuto
- **Reporte mensual:** disponible en `status.pymeshub.lat`
- **Umbral de fallo:** 3 cheques fallidos consecutivos = incidente

---

## 9. Contacto

Para reportar incidentes: soporte@pymeshub.lat  
Panel de estado: `status.pymeshub.lat`

---

*Última revisión: 2026-06-05*
