# Politica de Seguridad de la Informacion de PymesHub

## 1. Proposito

Esta política establece las **exigencias internas** de seguridad de la información de PymesHub. Protege la confidencialidad, integridad y disponibilidad de las cuentas de clientes, los datos de comercios, pedidos, repartidores, entregas y operaciones del marketplace. La identidad de la entidad jurídica responsable debe confirmarse antes de usar esta política para afirmar compromisos corporativos.

## 2. Alcance

Aplica a:

- ambientes de desarrollo, staging y produccion;
- web React, clientes móviles Expo/React Native, cliente de escritorio Tauri y API Cloudflare Workers;
- D1, KV, R2, Queues, Durable Objects, secretos, telemetría y servicios de identidad y notificaciones;
- endpoints de consola de plataforma y reportes de errores de NestJS/Railway, PostgreSQL y colas legadas **mientras sigan operativos**;
- personal interno, contratistas, soporte autorizado e integraciones de terceros;
- datos personales, direcciones y ubicaciones, pedidos, catálogos, suscripciones, credenciales, logs y artefactos de continuidad.

La arquitectura de referencia es [`../../../AGENTS.md`](../../../AGENTS.md). La dirección Cloudflare-only es un **objetivo**, no una afirmación de que todos los sistemas legados hayan sido retirados.

## 3. Definiciones clave

- `Activo de informacion`: sistema, dato, documento, secreto o recurso relevante para el servicio.
- `Control preventivo`: medida diseñada para evitar que ocurra un evento adverso.
- `Control detectivo`: medida orientada a identificar eventos o desvíos.
- `Control correctivo`: medida destinada a contener, remediar o recuperar.
- `Produccion`: ambiente que trata datos o trafico real de clientes.

## 4. Roles y responsables

- `Responsable del servicio`: define prioridades de riesgo y acepta riesgos residuales.
- `Responsable tecnico`: implementa controles, monitoreo, hardening y remediaciones.
- `Soporte autorizado`: accede solo con necesidad justificada, trazabilidad y permisos limitados.
- `Todo colaborador`: protege credenciales, equipos, sesiones e informacion a la que accede.

## 5. Principios de seguridad

- menor privilegio;
- necesidad de conocer;
- aislamiento por comercio, sucursal, usuario y rol, incluidos los endpoints que permanezcan en el backend legado;
- minimizacion de acceso y de exposicion de datos;
- trazabilidad de acciones criticas;
- defensa en profundidad razonable;
- mejora continua segun riesgo real del servicio.

## 6. Controles obligatorios

### 6.1 Preventivos

- autenticacion fuerte para administradores y personal interno;
- gestion de secretos fuera del codigo;
- separacion entre ambientes;
- restricciones de acceso a produccion;
- configuracion privada o controlada de storage, bases y colas;
- revisiones minimas de dependencias y configuraciones sensibles.

### 6.2 Detectivos

- logs de auditoria para acciones criticas;
- monitoreo de errores, fallos y eventos relevantes;
- revisiones periodicas de accesos y permisos;
- vigilancia de incidentes y de comportamiento anomalo.

### 6.3 Correctivos

- respuesta a incidentes;
- rotacion de credenciales comprometidas;
- restauracion desde backup cuando corresponda;
- bloqueo, suspension o mitigacion urgente de acceso o funcionalidad riesgosa.

## 7. Reglas especificas para PymesHub

- Los recursos privados deben autorizarse **del lado del servidor** según identidad, rol, comercio, sucursal y relación con el pedido; no basta con ocultarlos en la interfaz.
- Las transiciones de estado de pedidos, asignaciones de reparto, precios, cargos por entrega y límites de suscripciones deben validarse en el backend, sin confiar en importes o roles enviados por el cliente.
- Las direcciones, posiciones de repartidores, tokens de notificación y datos de terceros deben exponerse solo a actores autorizados y durante el tiempo necesario.
- R2 y los endpoints de media deben aplicar validación de tipo/tamaño y controles de acceso cuando el recurso no sea público; proteger credenciales de D1, KV, Queues y otros servicios.
- El soporte no debe acceder a datos de clientes o comercios sin justificación operativa y trazabilidad.
- Los logs y reportes de errores no deben contener secretos, sesiones, credenciales ni datos personales innecesarios; revisar también el receptor legado de reportes.
- El checkout de pedidos documentado es **pago contra entrega**. No describir una pasarela de tarjetas como activa en este flujo sin evidencia; evaluar por separado la facturación de suscripciones e integraciones heredadas.
- Las integraciones con terceros y cualquier componente aún operativo deben incluirse en el inventario y en la respuesta a incidentes.

## 8. Estado de controles y evidencia

Esta política define controles **esperados**, no certifica que cada control ya esté desplegado. Antes de declarar cumplimiento, el responsable técnico debe asociar cada control con pruebas, configuración, responsable y fecha. Las brechas deben registrarse como riesgo con acción correctiva.

### Registros

El sistema de seguridad debe poder sostenerse con:

- politicas vigentes;
- registros de revision de accesos;
- inventario de proveedores criticos;
- evidencia de backups y restauraciones;
- incidentes y acciones correctivas;
- registros de riesgos y excepciones aceptadas.

## 9. Excepciones y escalamiento

Cualquier excepcion a esta politica debe ser:

- temporal o justificada;
- aprobada por responsable competente;
- documentada con riesgo residual;
- revisada antes de convertirse en una desviacion permanente.

## 10. Frecuencia de revision

Esta politica debe revisarse al menos una vez al año y siempre que exista un cambio material en arquitectura, jurisdiccion, proveedores criticos o modelo de negocio.

## 11. Relacion con otros documentos

Esta politica se complementa con:

- [`access-control-policy.md`](./access-control-policy.md)
- [`incident-response-policy.md`](./incident-response-policy.md)
- [`backup-and-recovery-policy.md`](./backup-and-recovery-policy.md)
- [`secure-development-policy.md`](./secure-development-policy.md)
- [`../../risk/risk-register.md`](../../risk/risk-register.md)
- [`../../../SECURITY.md`](../../../SECURITY.md) — reporte externo y divulgación coordinada de vulnerabilidades; **no** sustituir por el documento interno

Los hallazgos recibidos a través de la política pública deben evaluarse y, cuando corresponda, escalarse mediante [`incident-response-policy.md`](./incident-response-policy.md).
