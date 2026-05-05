# Mapa de Servicios de Terceros de PymeHub

## 1. Proposito

Este mapa resume los servicios de terceros utilizados o previstos por PymeHub y la funcion que cumplen dentro de la arquitectura. Sirve como vista rapida de dependencias criticas para arquitectura, privacidad y vendor review.

## 2. Mapa

| Servicio | Funcion dentro de PymeHub | Tipo de datos implicados | Criticidad | Documento relacionado |
| --- | --- | --- | --- | --- |
| OpenAI | Insights, resúmenes, funciones IA | Contexto, prompts, outputs | Alta | `product-compliance/ai-usage-and-disclosure.md` |
| Resend | Correo transaccional | Correos, metadatos | Media/Alta | `security/subprocessors-list.md` |
| S3 / MinIO | Documentos y adjuntos | Archivos y metadatos | Alta | `security/subprocessors-list.md` |
| Redis / BullMQ | Jobs y automatizaciones | IDs, metadatos operativos | Media | `security/vendor-risk-register.md` |
| Hosting | API, web, base segun arquitectura final | Datos operativos | Alta | `security/security-policy.md` |
| Monitoreo | Alertas y errores | Logs y eventos | Media | `security/vendor-risk-register.md` |
| Pasarela de pago | Cobro de suscripciones | Datos de cobro del cliente | Alta | `business/pricing-billing-policy.md` |

## 3. Regla

Ningun servicio de terceros debe incorporarse a produccion sin quedar reflejado tambien en `subprocessors-list.md` y `vendor-risk-register.md`.
