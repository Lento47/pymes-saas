# Registro de Riesgo de Proveedores de PymesHub

## 1. Proposito

Este registro documenta la evaluacion minima de riesgo de los proveedores criticos de PymesHub. Su objetivo es que la dependencia de terceros no quede invisibilizada y que cada servicio externo relevante tenga owner, riesgo residual y accion pendiente.

## 2. Reglas de uso

- Debe actualizarse antes de introducir nuevos proveedores criticos.
- El riesgo residual debe reflejar el estado real, no el deseado.
- Toda accion pendiente debe tener responsable y fecha objetivo.

## 3. Registro

| Proveedor | Servicio | Datos tratados | Criticidad | Region | DPA/TOS revisado | Medidas observadas | Riesgo residual | Estado | Accion pendiente | Fecha objetivo | Dueño |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | IA generativa | Contexto, prompts, outputs | Alta | `[POR_CONFIRMAR]` | `[PENDIENTE]` | Minimización, configuracion, control contractual | Medio | En revision | Definir politica de opt-out por cliente | `[FECHA]` | `[RESPONSABLE]` |
| Resend | Email transaccional | Correos y metadatos | Media/Alta | `[POR_CONFIRMAR]` | `[PENDIENTE]` | TLS, controles del proveedor | Medio | En revision | Validar retencion y rebotes | `[FECHA]` | `[RESPONSABLE]` |
| S3/MinIO | Storage | Documentos y adjuntos | Alta | `[POR_CONFIRMAR]` | `[PENDIENTE]` | IAM, buckets privados, cifrado | Medio | En revision | Revisar lifecycle y acceso | `[FECHA]` | `[RESPONSABLE]` |
| Hosting | Infraestructura app | Datos de servicio | Alta | `[POR_CONFIRMAR]` | `[PENDIENTE]` | Aislamiento, logs, backups | Medio/Alto | En revision | Cerrar proveedor final | `[FECHA]` | `[RESPONSABLE]` |
| Redis | Colas/cache | Jobs y metadatos | Media | `[POR_CONFIRMAR]` | `[PENDIENTE]` | Red privada, auth | Bajo/Medio | En revision | Confirmar persistencia y backups | `[FECHA]` | `[RESPONSABLE]` |
