# Aviso de Subencargados de PymesHub
Versión 2.0 — Última actualización: Abril 2026

> ⚠️ **Documento crítico de transparencia de datos**
> Este Aviso describe los terceros que pueden procesar datos personales en nombre de PymesHub.

---

## 1. Alcance

Este Aviso identifica a los proveedores que actúan como:

- Subencargados de datos personales
- Proveedores de infraestructura
- Procesadores tecnológicos

Estos terceros pueden acceder, procesar o almacenar datos personales únicamente en la medida necesaria para operar el Servicio.

Este documento forma parte del:

- Data Processing Addendum (DPA)
- Términos de Servicio
- Política de Privacidad

---

## 2. Clasificación de proveedores

Para claridad, PymesHub clasifica proveedores en:

- **Infraestructura crítica**
- **Procesadores de pago**
- **Mensajería**
- **Inteligencia artificial**
- **Analítica y monitoreo**

---

## 3. Subencargados actuales

---

### 3.1 Infraestructura y hosting

| Proveedor | Función | Datos procesados | Región |
|----------|--------|------------------|--------|
| Cloudflare, Inc. | CDN, seguridad perimetral, Workers | IP, requests, headers, tráfico | Global |
| Railway / PostgreSQL provider | Base de datos, ejecución backend | Datos del workspace, mensajes, documentos | Región configurada |
| Almacenamiento cloud (S3-compatible) | Archivos, adjuntos | Documentos, media, backups | Variable |

⚠️ **Acceso restringido:**  
Estos proveedores no acceden a datos a nivel humano, solo a nivel infraestructura.

---

### 3.2 Procesamiento de pagos

| Proveedor | Función | Datos | Región |
|----------|--------|------|--------|
| Paddle | Pagos, facturación, impuestos | Datos de pago tokenizados, facturación | Global (EE.UU., UE) |

⚠️ Paddle actúa como:

- Merchant of Record (según caso)
- Procesador de pagos

PymesHub **no almacena datos completos de tarjetas**.

---

### 3.3 Mensajería

| Proveedor | Canal | Datos | Región |
|----------|------|------|--------|
| Meta Platforms (WhatsApp) | WhatsApp Business API | Teléfono, mensajes, metadata | Global |
| Telegram (según integración) | Bot/API | ID usuario, mensajes | Global |
| Email providers | SMTP/API | Email, contenido | Variable |

⚠️ Importante:

- PymesHub no controla procesamiento en estos proveedores
- El Cliente es responsable de consentimiento

---

### 3.4 Inteligencia artificial

| Proveedor | Función | Datos | Región |
|----------|--------|------|--------|
| Proveedores de IA (ej: OpenAI, Google, etc.) | Clasificación, resumen, sugerencias | Fragmentos de texto, prompts | Variable |

⚠️ **Restricciones clave:**

- No entrenamiento con datos del Cliente (por contrato)
- No persistencia fuera de uso operativo (cuando aplica)
- Minimización de datos en prompts

---

### 3.5 Analítica y monitoreo

| Proveedor | Función | Datos | Región |
|----------|--------|------|--------|
| Google Analytics | Métricas | Datos anonimizados | Global |
| Herramientas de monitoreo | Logs, errores | Metadatos técnicos | Variable |

⚠️ No acceden a:

- Contenido de mensajes
- Datos sensibles del Cliente

---

## 4. Flujo y control de datos (AGREGADO)

PymesHub controla:

- Qué datos se envían
- Cuándo se envían
- A qué proveedor

Los proveedores:

- No deciden finalidades
- No reutilizan datos
- Actúan bajo instrucciones contractuales

---

## 5. Transferencias internacionales

Los datos pueden transferirse fuera de Costa Rica.

PymesHub garantiza:

- Contratos adecuados
- Protección equivalente
- Evaluación de proveedores

Compatible con estándares internacionales (GDPR-style).

---

## 6. Actualización de subencargados

PymesHub puede modificar esta lista.

Cambios materiales:

- Notificación ≥ 15 días
- Email o plataforma

---

## 7. Derecho de objeción

El Cliente puede objetar:

- Por razones de seguridad
- Por cumplimiento

Si no hay solución:

👉 Puede terminar el servicio sin penalización

---

## 8. Obligaciones contractuales

Todos los subencargados deben:

- Procesar solo bajo instrucciones
- Mantener confidencialidad
- Aplicar seguridad
- Notificar incidentes
- Eliminar datos al finalizar

---

## 9. Seguridad y aislamiento (AGREGADO)

PymesHub implementa:

- Multi-tenant isolation
- Access control
- Logging
- Encryption

Los subencargados:

- No acceden entre clientes
- No cruzan datos entre workspaces

---

## 10. Responsabilidad

PymesHub:

- Es responsable frente al Cliente
- Responde por subencargados

---

## 11. Relación con el DPA

Este documento complementa el DPA.

En caso de conflicto:

👉 Prevalece el DPA

---

## 12. Contacto

legal@pymeshub.lat

---

© 2026 PymesHub S.A.