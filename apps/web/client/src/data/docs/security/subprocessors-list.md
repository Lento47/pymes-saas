# Lista de Subprocesadores y Servicios de Terceros de PymesHub

## 1. Proposito

Este registro identifica los terceros que apoyan la prestacion de PymesHub y que pueden tratar datos del cliente o datos operativos del servicio. Su objetivo es mantener trazabilidad sobre el mapa real de tratamiento y apoyar la politica de privacidad, el DPA y la gestion de vendors.

## 2. Reglas de uso

- Todo proveedor nuevo debe registrarse antes de tratar datos reales de clientes.
- La lista debe mantenerse alineada con arquitectura, privacidad y vendor review.
- Un proveedor critico no debe entrar a produccion sin evaluacion minima de riesgo.

## 3. Registro vivo

| Proveedor | Servicio | Datos tratados | Criticidad | Region | Base contractual / notas | Estado | Ultima revision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | Resúmenes IA, insights, apoyo de clasificacion | Prompts, contexto operativo, outputs | Alta | `[POR_CONFIRMAR]` | Revisar TOS, DPA y minimizacion | Activo o previsto | `[FECHA]` |
| Resend | Correo transaccional y notificaciones | Correos, metadatos de envio | Media/Alta | `[POR_CONFIRMAR]` | Validar retencion y rebotes | Activo o previsto | `[FECHA]` |
| AWS S3 o MinIO | Almacenamiento de documentos | Archivos, metadatos, OCR asociado | Alta | `[POR_CONFIRMAR]` | Confirmar cifrado y lifecycle | Activo o previsto | `[FECHA]` |
| Hosting principal | Ejecucion de API/web | Datos de aplicacion y logs | Alta | `[POR_CONFIRMAR]` | Definir proveedor final | Activo o previsto | `[FECHA]` |
| Redis | Colas y cache | IDs, jobs, metadatos operativos | Media | `[POR_CONFIRMAR]` | Confirmar persistencia y acceso | Activo o previsto | `[FECHA]` |
| Monitoreo / observabilidad | Alertas y errores | Logs, errores, eventos | Media | `[POR_CONFIRMAR]` | Minimizar datos en payloads | Activo o previsto | `[FECHA]` |
| Pasarela de pago | Cobro de suscripciones | Datos de cobro y cliente | Alta | `[POR_CONFIRMAR]` | No almacenar PAN en PymesHub | Activo o previsto | `[FECHA]` |

## 4. Relacion con otros documentos

Este registro debe mantenerse alineado con:

- [`vendor-risk-register.md`](./vendor-risk-register.md)
- [`../legal/data-processing-addendum.md`](../legal/data-processing-addendum.md)
- [`../legal/privacy-policy.md`](../legal/privacy-policy.md)
