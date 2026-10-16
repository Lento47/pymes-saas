# PymesHub — Availability and continuity

- [English](#english)
- [Español](#espanol)

---

## English

**What we aim for on availability, what we will do when something breaks, and what we are not promising.** This page replaces the old service-level document: instead of a percentage nobody can stand behind during a beta, it says what actually happens.

### What is promised, and what is not

- **No numeric uptime target is published today.** We do not publish a percentage we cannot measure and honour, and a written commitment of that kind is something a customer asks for explicitly rather than reads off a page.
- **What we do commit to:** keeping the marketplace running, telling you about planned work in advance, prioritising anything that blocks orders and deliveries, and saying what we know when something is wrong instead of going quiet.
- **No automatic service credits.** Nothing on this page entitles anyone to compensation, a discount or a free period. A separate written agreement can define credits; this page does not.

### Planned maintenance

- Maintenance that could be noticeable is announced **in advance**, with what is happening and what will be unavailable.
- It is scheduled in **the least disruptive window available**, and in Costa Rican business terms — not in the middle of a lunch service.
- The web application updates as changes ship; that is how a fix reaches you without anyone installing anything. The mobile applications follow their store release cycle, so a change can reach the web before the phone.

### When something breaks

1. **Detected.** Availability, errors and queue backups are monitored, and a failure in the API or the live order updates raises attention.
2. **Contained first.** The priority is to stop the harm — pause what is unsafe, roll back what just changed, or disable the piece that is failing.
3. **Fixed.** Then the cause is corrected, not just the symptom.
4. **Told.** If the impact was noticeable, we say what happened, what was affected, and what was done — through the product and to the accounts affected. For anything involving personal data, the notification rules in the privacy documents apply.
5. **Reviewed.** A repeated failure gets a structural fix rather than another patch.

### What is excluded from any availability expectation

- Your own connectivity, device, browser or network.
- Anything happening on third-party infrastructure we do not control.
- Misconfiguration or misuse on the customer's side, including attempts to bypass limits.
- Force majeure, and general outages that affect a whole provider or region.
- Scheduled maintenance that was announced.

### Business continuity and data

- The database and the object storage live in the same cloud provider's network, and the **backups are the provider's**, held on their ordinary rotation cycle.
- Backups are for **recovering the service**, not for resurrecting a deleted account — see the data and privacy page for what deletion does and does not remove.
- Order and payment records are append-only where correctness matters, so a correction is a new fact rather than an edit of history.

### Talking to us during an incident

- Use the support channels on the [support policy](/documentation/support-policy) page.
- **Security incidents** have their own channel and their own timelines: see the [security advisories](/documentation/security-advisories) page.
- During a broad incident, an individual answer may be slower than usual because the same people are fixing it. That is not silence; it is the order of work.

### What this page does not claim

- It creates no service level agreement, no warranty and no credit entitlement.
- It does not promise a recovery time or a recovery point; those are things a written agreement states, and none is published here.
- It does not cover the mobile or desktop applications separately — they run against the same API, so an API incident is their incident too.

---

## Español

**Qué buscamos en disponibilidad, qué vamos a hacer cuando algo se rompa y qué no estamos prometiendo.** Esta página reemplaza al documento de niveles de servicio anterior: en lugar de un porcentaje que nadie puede sostener durante una beta, dice lo que pasa de verdad.

### Qué se promete y qué no

- **Hoy no se publica un objetivo numérico de disponibilidad.** No publicamos un porcentaje que no podamos medir ni cumplir, y un compromiso así por escrito es algo que un cliente pide explícitamente en vez de leerlo en una página.
- **Sí nos comprometemos a:** mantener el marketplace funcionando, avisarte los trabajos programados con antelación, priorizar todo lo que bloquee pedidos y entregas, y decir lo que sabemos cuando algo anda mal en vez de quedarnos en silencio.
- **Sin créditos automáticos.** Nada de esta página da derecho a compensación, descuento ni período gratuito. Un acuerdo escrito aparte puede definir créditos; esta página no lo hace.

### Mantenimiento programado

- El mantenimiento que pueda notarse se anuncia **con antelación**, con qué se va a hacer y qué va a estar no disponible.
- Se agenda en **la ventana menos disruptiva disponible**, y en términos del día costarricense — no en medio del servicio de almuerzo.
- La aplicación web se actualiza a medida que salen los cambios; así llega una corrección sin que nadie instale nada. Las aplicaciones móviles siguen su ciclo de publicación en tienda, así que un cambio puede llegar antes a la web que al teléfono.

### Cuando algo se rompe

1. **Detección.** Se monitorean disponibilidad, errores y atrasos de cola, y una falla en la API o en las actualizaciones del pedido en vivo llama la atención.
2. **Contener primero.** La prioridad es cortar el daño: pausar lo que sea inseguro, revertir lo que se acaba de cambiar o apagar la pieza que falla.
3. **Corregir.** Después se arregla la causa, no solo el síntoma.
4. **Contar.** Si el impacto se notó, decimos qué pasó, a quién afectó y qué se hizo — dentro del producto y a las cuentas afectadas. Para todo lo que involucre datos personales, aplican las reglas de notificación de los documentos de privacidad.
5. **Revisar.** Una falla repetida recibe una corrección estructural y no otro parche.

### Qué queda excluido de cualquier expectativa de disponibilidad

- Tu propia conectividad, dispositivo, navegador o red.
- Cualquier cosa que ocurra en infraestructura de terceros que no controlamos.
- Malas configuraciones o mal uso del lado del cliente, incluidos los intentos de saltarse límites.
- Fuerza mayor, y caídas generales que afecten a un proveedor o a una región entera.
- El mantenimiento programado que ya se anunció.

### Continuidad y datos

- La base de datos y el almacenamiento de objetos viven en la red del mismo proveedor de nube, y **los respaldos son del proveedor**, sujetos a su ciclo ordinario de rotación.
- Los respaldos sirven para **recuperar el servicio**, no para resucitar una cuenta eliminada — la página de datos y privacidad explica qué elimina y qué no elimina la eliminación de cuenta.
- Los registros de pedidos y pagos son de solo agregar donde la exactitud importa, así que una corrección es un hecho nuevo y no una edición de la historia.

### Hablar con nosotros durante un incidente

- Usá los canales de la página de [política de soporte](/documentation/support-policy).
- Los **incidentes de seguridad** tienen su propio canal y sus propios plazos: ver la página de [avisos de seguridad](/documentation/security-advisories).
- Durante un incidente amplio, una respuesta individual puede tardar más de lo habitual porque las mismas personas están arreglándolo. No es silencio; es el orden del trabajo.

### Lo que esta página no afirma

- No genera ningún acuerdo de nivel de servicio, ninguna garantía ni derecho a créditos.
- No promete un tiempo de recuperación ni un punto de recuperación; eso lo dice un acuerdo escrito, y acá no se publica ninguno.
- No cubre por separado a las aplicaciones móviles ni de escritorio: corren contra la misma API, así que un incidente de la API es su incidente también.
