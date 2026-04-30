# Aviso de Subencargados de PymeHub

Última actualización: Abril 2026.

## 1. Alcance

Este Aviso enumera los terceros que pueden tratar datos personales por cuenta de PymeHub como subencargados, proveedores tecnológicos o intermediarios en la prestación del Servicio. Se actualiza periódicamente, y los cambios materiales son comunicados a los clientes con una antelación no inferior a quince días.

Para los efectos de la legislación costarricense (Ley N.º 8968 y su Reglamento), estos terceros actúan como encargados o proveedores de servicios que tratan datos siguiendo las instrucciones de PymeHub y con obligaciones contractuales de confidencialidad, seguridad y limitación de finalidad.

## 2. Subencargados actuales

### Infraestructura y hosting

| Proveedor | Función | Categorías de datos | Región de tratamiento |
|-----------|---------|---------------------|-----------------------|
| Railway | Infraestructura cloud, base de datos PostgreSQL, almacenamiento de archivos, ejecución de workers | Datos de cuenta, workspace, mensajes, contactos, facturas, documentos, logs | EE.UU. (us-west) |

### Correo transaccional y notificaciones

| Proveedor | Función | Categorías de datos | Región de tratamiento |
|-----------|---------|---------------------|-----------------------|
| Resend | Envío de correos electrónicos transaccionales, notificaciones del sistema, alertas, invitaciones a workspace | Correo electrónico, nombre, contenido de notificaciones | EE.UU. |

### Procesamiento de pagos

| Proveedor | Función | Categorías de datos | Región de tratamiento |
|-----------|---------|---------------------|-----------------------|
| Paddle | Procesamiento de pagos, gestión de suscripciones, facturación, cálculo de impuestos | Datos de facturación, método de pago, historial de transacciones, identificador de cliente | Global (servidores en EE.UU. y UE) |

Paddle actúa como revendedor autorizado de productos digitales y procesador de pagos. Su relación contractual con PymeHub se rige por un Master Services Agreement, un Data Sharing Addendum y un Data Processing Addendum. El Cliente puede consultar los términos de Paddle en [paddle.com/legal](https://paddle.com/legal).

### Inteligencia artificial y procesamiento de documentos

| Proveedor | Función | Categorías de datos | Región de tratamiento |
|-----------|---------|---------------------|-----------------------|
| OpenAI | Modelos de lenguaje, clasificación de mensajes, resumen de conversaciones, extracción de datos de documentos, OCR, sugerencias de respuesta | Contenido de prompts, contexto operativo, fragmentos de conversaciones (sin datos de contacto del usuario final) | EE.UU. |

PymeHub exige contractualmente a sus proveedores de IA que no utilicen los datos del Cliente para entrenar, afinar o mejorar sus modelos sin consentimiento explícito. El output generado por los modelos de IA se considera Customer Data del Cliente y no es reutilizado por el proveedor para fines incompatibles con la prestación del Servicio.

### Mensajería

| Proveedor | Función | Categorías de datos | Región de tratamiento |
|-----------|---------|---------------------|-----------------------|
| Meta Platforms, Inc. (WhatsApp Business API) | Mensajería empresarial a través de WhatsApp | Números de teléfono, contenido de mensajes, metadatos de conversación según las políticas de Meta | Global (según infraestructura de Meta) |

El uso de WhatsApp Business API está sujeto a las Business Terms, Business Solution Terms, Messaging Policy y demás términos de Meta. PymeHub no controla el tratamiento de datos que Meta realiza en su propia plataforma. El Cliente es responsable de cumplir con las políticas de Meta y de obtener el consentimiento de sus usuarios finales para la mensajería a través de WhatsApp.

### Analítica y monitoreo

| Proveedor | Función | Categorías de datos | Región de tratamiento |
|-----------|---------|---------------------|-----------------------|
| Google Analytics | Analítica de uso, medición de rendimiento, embudos de conversión | Datos seudonimizados de sesión, páginas visitadas, eventos de interacción, tipo de navegador, sistema operativo | EE.UU. |
| Sentry | Monitoreo de disponibilidad, detección de errores, alertas de rendimiento | Metadatos técnicos, logs de servidor, IP de origen, códigos de error HTTP | EE.UU. |

Los proveedores de analítica y monitoreo no reciben datos que permitan identificar directamente a personas físicas ni acceden al contenido de conversaciones, documentos u otros datos de negocio del Cliente.

## 3. Actualización de la lista de subencargados

PymeHub se reserva el derecho de modificar esta lista en cualquier momento para reflejar cambios en su infraestructura, proveedores o servicios. Los cambios materiales serán notificados a los clientes con al menos quince días de antelación mediante:

- Publicación de la versión actualizada en el sitio web de la Plataforma.
- Correo electrónico a la dirección registrada en la cuenta del Cliente.
- Aviso dentro de la Plataforma.

## 4. Derecho de objeción

El Cliente podrá objetar, por motivos razonables de privacidad, seguridad o cumplimiento normativo, la incorporación de un nuevo subencargado o un cambio material en un subencargado existente. La objeción debe presentarse por escrito a legal@[dominio] dentro del plazo de notificación.

Si PymeHub no puede atender razonablemente la objeción, las partes negociarán de buena fe una solución. Si no se alcanza una solución satisfactoria, el Cliente podrá resolver el contrato sin penalización.

## 5. Compromisos contractuales de los subencargados

Todos los subencargados están sujetos a obligaciones contractuales que incluyen como mínimo:

- Tratar los datos personales únicamente conforme a las instrucciones documentadas de PymeHub.
- No utilizar los datos personales para finalidades propias incompatibles con la prestación del Servicio.
- Implementar medidas de seguridad técnicas, administrativas y físicas apropiadas al riesgo del tratamiento.
- Garantizar la confidencialidad del personal autorizado para acceder a los datos.
- Notificar a PymeHub sin demora indebida cualquier incidente de seguridad que afecte los datos personales.
- Cooperar con PymeHub en el ejercicio de derechos de los titulares y en el cumplimiento de las obligaciones legales de PymeHub.
- Suprimir o devolver los datos personales al terminar la relación contractual con PymeHub.

## 6. Contacto

Para consultas, objeciones o solicitudes de información adicional sobre los subencargados:

- **Correo electrónico:** legal@[dominio]
