# Politica de Desarrollo Seguro de PymesHub

## 1. Proposito

Esta política integra controles básicos de seguridad al ciclo de desarrollo del marketplace PymesHub para reducir exposición de secretos, fallas de autorización, accesos entre comercios, errores de pedidos, pérdidas de privacidad y regresiones en componentes operativos.

## 2. Alcance

Aplica a:

- cambios de codigo, configuracion e infraestructura;
- manejo de dependencias;
- uso de datos en desarrollo y pruebas;
- acceso a ambientes;
- revisiones técnicas previas a despliegue;
- cambios en clientes React/Expo/Tauri, API Cloudflare Workers, D1/KV/R2/Queues y servicios residuales NestJS/Railway que sigan operativos.

## 3. Reglas obligatorias

- Todo cambio relevante debe quedar en control de version.
- Las ramas, PRs o mecanismos equivalentes deben permitir trazabilidad.
- No deben subirse secretos al repositorio.
- Las dependencias nuevas deben justificarse y revisarse minimamente.
- Los datos reales de clientes no deben usarse en desarrollo sin autorizacion excepcional.
- El acceso a produccion debe ser limitado, justificado y trazable.

## 4. Revisiones tecnicas minimas

Todo cambio sensible debe revisar, al menos:

- autenticación, autorización por rol, aislamiento de comercios y sucursales, y prevención de acceso directo a objetos de otro usuario;
- creación y transición de pedidos, asignación de repartidores, precios, promociones, tarifas de entrega e integridad de suscripciones;
- ubicación, direcciones, datos de clientes/repartidores, tokens de dispositivos y datos expuestos en logs o reportes de errores;
- endpoints de exportación, borrado, administración, soporte y consola legada que permanezcan activos;
- validación de uploads, control de acceso en R2, configuración de Worker/D1/KV/Queues, webhooks y servicios externos;
- segregación entre entornos, secretos, migraciones de D1 y configuración de las integraciones externas;
- impacto en privacidad, aceptación legal y auditoría cuando corresponda.

## 5. Vulnerabilidades y dependencias

Las vulnerabilidades detectadas deben clasificarse según criticidad y gestionarse conforme al riesgo del servicio realmente expuesto. La política de reporte externo y divulgación coordinada es [`../../../SECURITY.md`](../../../SECURITY.md); la escalada de hallazgos confirmados se rige por [`incident-response-policy.md`](./incident-response-policy.md). Evitar dependencias innecesarias, abandonadas o de procedencia dudosa.

## 6. Ambientes

PymesHub debe mantener separacion entre desarrollo, staging y produccion, con:

- variables de entorno diferenciadas;
- secretos independientes;
- accesos controlados;
- minima reutilizacion indebida de datos reales.

## 7. Evidencia y seguimiento

El proceso debe poder sostener evidencia de (sin afirmar que todas las verificaciones están automatizadas o desplegadas):

- revisiones tecnicas relevantes;
- vulnerabilidades detectadas y remediadas;
- cambios sensibles desplegados;
- excepciones aprobadas.
