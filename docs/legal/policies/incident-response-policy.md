# Politica de Respuesta a Incidentes de Seguridad de PymesHub

## 1. Proposito

Esta politica define como PymesHub detecta, clasifica, contiene, investiga, comunica y cierra incidentes de seguridad. Su objetivo es reducir dano, preservar evidencia y asegurar una respuesta consistente ante eventos que afecten la confidencialidad, integridad o disponibilidad del servicio.

## 2. Alcance

Aplica a incidentes reales o sospechados que involucren:

- acceso no autorizado;
- fuga o exposicion de datos;
- compromiso de credenciales;
- pérdida de aislamiento entre clientes, comercios o sucursales;
- manipulación de precios, pedidos, entregas, cobros o suscripciones;
- exposición de direcciones, ubicación de repartidores, información de pedidos o tokens de dispositivos;
- indisponibilidad grave del servicio;
- abuso o uso malicioso de integraciones;
- alteración no autorizada de configuraciones o datos;
- incidentes de Cloudflare Workers/D1/KV/R2/Queues y de endpoints NestJS/Railway todavía operados;
- incidentes en proveedores críticos con impacto en PymesHub.

## 3. Definicion de incidente

Se considera incidente cualquier evento que comprometa o pueda comprometer la seguridad o continuidad del servicio, de los datos del cliente o de la operacion interna del Proveedor.

## 4. Roles y responsables

- `Coordinador del incidente`: `[RESPONSABLE_INCIDENTES]`
- `Lider tecnico`: `[RESPONSABLE_TECNICO]`
- `Responsable de comunicacion a clientes`: `[RESPONSABLE_CLIENTES]`
- `Responsable legal/privacidad`: `[RESPONSABLE_PRIVACIDAD]` (verificar la operación de `privacidad@pymeshub.lat` antes de usarlo como contacto externo)

Los identificadores entre corchetes son **roles pendientes de designación**; no deben presentarse como equipo de respuesta operativo hasta asignar suplentes y canales de contacto.

El Coordinador del incidente es responsable de abrir, mantener y cerrar el expediente operativo del caso.

## 5. Clasificacion de severidad

- `SEV-1`: impacto critico. Posible fuga de datos, perdida de aislamiento multi-tenant, caida sustancial o compromiso grave del servicio.
- `SEV-2`: impacto alto. Afectacion relevante pero contenida, o riesgo serio sin evidencia de daño masivo.
- `SEV-3`: impacto moderado. Incidente acotado, intento bloqueado o afectacion parcial con workaround.
- `SEV-4`: evento menor, hallazgo preventivo o falso positivo confirmado.

## 6. Tiempos objetivo de respuesta

- `SEV-1`: activacion inmediata y contencion prioritaria.
- `SEV-2`: activacion prioritaria dentro de la ventana operativa mas cercana.
- `SEV-3`: gestion programada con seguimiento.
- `SEV-4`: documentacion y remediacion segun criticidad residual.

## 7. Flujo operativo

Los reportes de vulnerabilidades de investigadores externos se reciben mediante la política pública [`../../../SECURITY.md`](../../../SECURITY.md). La recepción de un hallazgo no demuestra por sí sola un incidente: primero se valida impacto, exposición y evidencia. Si hay explotación, acceso no autorizado, exposición de datos o daño operativo, abrir un incidente según esta política. Los objetivos de respuesta para reportes de vulnerabilidad no sustituyen la contención inmediata de incidentes críticos.

Al iniciar un incidente, comprobar **ambas** superficies mientras sigan desplegadas: API del marketplace en Cloudflare y endpoints heredados de consola/reportes en NestJS/Railway. No asumir que migrar una funcionalidad retira automáticamente su endpoint, base de datos o cola anterior.

### 7.1 Deteccion y apertura

Toda deteccion debe registrar:

- fecha y hora;
- fuente del hallazgo;
- sistemas o datos potencialmente afectados;
- severidad preliminar;
- responsable asignado.

### 7.2 Contencion

La prioridad inicial es limitar dano. La contencion puede incluir:

- revocacion de accesos o sesiones;
- rotacion de credenciales;
- aislamiento de componentes;
- suspension temporal de funcionalidades;
- bloqueo de procesos o integraciones comprometidas.

### 7.3 Preservacion de evidencia

Antes de alterar mas de lo necesario el entorno, se debe preservar razonablemente:

- logs;
- timestamps;
- configuraciones afectadas;
- artefactos o muestras relevantes;
- decisiones tomadas durante la respuesta.

### 7.4 Investigacion

Debe determinarse, en la medida posible:

- causa raiz o causa mas probable;
- ventana temporal del incidente;
- datos, clientes, comercios, sucursales, pedidos, repartidores o servicios heredados afectados;
- controles fallidos o ausentes;
- necesidad de comunicacion externa.

### 7.5 Recuperacion

La recuperacion debe ejecutarse de forma controlada y puede incluir:

- restauracion de componentes;
- reconfiguracion segura;
- validacion post-fix;
- monitoreo reforzado por un periodo razonable.

### 7.6 Cierre y postmortem

Todo incidente relevante debe cerrar con:

- estado final;
- impacto confirmado o descartado;
- acciones correctivas;
- responsables y fechas objetivo;
- decision sobre seguimiento.

## 8. Comunicacion

La comunicacion interna y externa debe ser coordinada para evitar mensajes contradictorios. Cuando el incidente afecte datos personales, continuidad relevante o compromisos contractuales, la entidad responsable verificada deberá evaluar las notificaciones exigibles por la ley aplicable y los contratos, con asesoramiento jurídico cuando proceda. No asumir plazos regulatorios sin validación específica.

La comunicacion a clientes debe incluir, en la medida razonable:

- descripcion general del incidente;
- fechas relevantes;
- sistemas o datos afectados;
- medidas adoptadas;
- recomendaciones al cliente, si existen;
- canal de seguimiento.

Se utilizara como base [`../../templates/incident-notification-template.md`](../../templates/incident-notification-template.md).

## 9. Evidencia y registros

Todo incidente debe dejar, como minimo:

- expediente o ticket;
- linea de tiempo;
- personas involucradas;
- severidad inicial y final;
- decisiones de contencion;
- evidencia tecnica disponible;
- decisiones de comunicacion;
- acciones correctivas y responsables.

## 10. Escalamiento

Se debe escalar inmediatamente a legal/privacidad y a direccion responsable cuando:

- exista sospecha de fuga de datos;
- haya afectacion multi-tenant;
- se requiera notificacion externa;
- el incidente comprometa clientes enterprise o contratos sensibles;
- el impacto reputacional o regulatorio sea alto.

## 11. Frecuencia de revision

Esta politica debe revisarse al menos una vez al año y tras cualquier incidente `SEV-1` o `SEV-2` que revele cambios necesarios.
