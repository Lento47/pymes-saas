# PymesHub — Reporting security problems, and security advisories

- [English](#english)
- [Español](#espanol)

---

## English

**How to report a security problem privately, what we promise in return, what is in scope, and where fixes are published.** If you found something, read the first section and report it privately — please do not open a public issue.

### Reporting a vulnerability

**Do not report security vulnerabilities in public GitHub issues, pull requests, discussions, reviews or social media.**

1. **Preferred:** use **GitHub private vulnerability reporting** on the repository (`Security → Report a vulnerability`), when that option is available.
2. **Alternative:** email **security@pymeshub.com**.
3. If neither channel works for you, ask a maintainer through a non-sensitive channel for a secure way to send the details — **without putting the vulnerability in that message**.

We never ask a reporter to hand over passwords, access tokens, payment credentials or personal data that is not needed to reproduce the problem.

### What to include

- A concise description of the problem, its impact, and how bad you think it is.
- The affected component, environment, app version or commit.
- Reproduction steps, and a minimal proof of concept that uses only accounts, businesses and data you own or are authorised to test.
- Sanitised requests, responses, logs or screenshots — with secrets and personal data removed.
- Any mitigation you know of, and whether you want to be credited (and how).

### What to expect

These are **targets, not guaranteed deadlines**. They can move with exploitability, customer impact, how complex the fix is, and coordinated release constraints.

| Stage | Target |
| --- | --- |
| Acknowledge the report | Within **3 business days** |
| Initial triage and severity assessment | Within **10 business days** |
| Critical: mitigation or fix | **7 calendar days** after validation |
| High: mitigation or fix | **30 calendar days** after validation |
| Medium: mitigation or fix | **90 calendar days** after validation |
| Low | Best effort |

Active exploitation, threats to people's safety, exposure of sensitive information, order integrity and financial correctness come first. If a full fix takes longer, we may apply a temporary mitigation and tell you the revised plan privately.

### What is in scope

For assets PymesHub owns or operates:

- the live **web** and **iOS/Android** applications, sessions and account recovery;
- the live **API** — authentication, authorisation, and the role boundaries between customers, business owners and staff, couriers, support and administrators;
- **isolation between businesses**, unauthorised access to another business's private data, and insecure direct object references;
- **product and inventory integrity**, cart and checkout calculations, delivery fees, promotions, and who may move an order to which state;
- **payment business logic where it exists** — noting that the marketplace takes payment on delivery (cash or SINPE Móvil) and does **not** run an online card flow;
- **delivery assignment and tracking**, unauthorised disclosure of location, customer addresses, courier details, and order-related personal information;
- **uploads and media access**, storage permissions, event and webhook processing, exposed secrets, and cloud configuration.

A vulnerability in **how our application integrates** a third-party service is in scope. Testing or attacking the third-party service itself is not.

### What is out of scope

- Social engineering, phishing, physical attacks, and attacks against third-party infrastructure.
- Denial-of-service, stress and load testing, resource exhaustion, or anything that materially degrades availability.
- Destructive testing, spam, mass account creation, or contacting customers, businesses or couriers without permission.
- Raw automated scanner output, generic best-practice observations, and missing headers with no demonstrated security impact.
- Retired components that are not deployed, unless they expose a real risk to the supported product.

### Rules for testing

- Use only accounts, businesses, devices and data you own or have explicit permission to use.
- **Never intentionally access, change, keep or extract another person's or business's data.** If you run into it by accident, stop, collect no more, and report it privately and promptly.
- Do not create real orders, deliveries, refunds, payouts or charges without prior authorisation. Use test data, and a non-production environment where one is available.
- Do not bypass rate limits with high-volume traffic, and do not degrade the service. No persistence, no malware, no lateral movement, no reaching infrastructure you were not authorised to reach.
- Collect the minimum evidence needed to show the impact, and remove personal data and secrets before submitting it.
- Stop testing once you have enough evidence, and give us time to fix it.

### Coordinated disclosure, credit and advisories

- Give us a reasonable chance to investigate, mitigate and release a fix before publishing technical details. **We coordinate the timeline with you** rather than requiring an indefinite embargo.
- When appropriate, verified advisories are published through **GitHub Security Advisories** for the repository.
- The proposed identifier format is **`OTL-SA-YYYY-NNN`** (for example `OTL-SA-2026-001`). An identifier is assigned **only to an advisory that is actually published**. PymesHub may also publish advisories on this site once that page is operational and verified — it is not live yet.
- Reporters may ask for public credit or for anonymity. Work found internally is credited as **Reported by PymesHub Security**.

**Published advisories: none yet.** When there is one, it appears here with its identifier, its severity, the affected versions, the fixed version, and the credit.

### Safe harbour

We support good-faith research carried out within this scope and these rules. For research we can lawfully authorise, PymesHub does not intend to pursue legal action solely for compliant testing and private reporting.

This does not extend to third-party systems, unlawful conduct, privacy violations, deliberate disruption, or anything outside our control, and it does not override applicable law or bind third parties.

### What this page does not claim

- The authoritative security policy is the repository's `SECURITY.md`, and it is **being updated to match this page** — the marketplace-aligned version is prepared and awaiting publication. While both exist, the targets above are the ones we work to, and if the repository's file states a shorter commitment for any stage, that shorter one applies.
- The advisory identifier scheme and a dedicated advisories page on the site are **proposed, not live**; today, advisories are published through GitHub Security Advisories.
- No security measure is absolute, and this page creates no warranty.

---

## Español

**Cómo reportar un problema de seguridad en privado, qué prometemos a cambio, qué queda dentro del alcance y dónde se publican las correcciones.** Si encontraste algo, leé la primera sección y reportalo en privado — por favor no abras un issue público.

### Reportar una vulnerabilidad

**No reportes vulnerabilidades de seguridad en issues, pull requests, discusiones, revisiones de GitHub ni redes sociales.**

1. **Preferido:** usá el **reporte privado de vulnerabilidades de GitHub** en el repositorio (`Security → Report a vulnerability`), cuando esa opción esté disponible.
2. **Alternativa:** escribí a **security@pymeshub.com**.
3. Si ningún canal te sirve, pedile a alguien del equipo, por un canal no sensible, una forma segura de enviar los detalles — **sin poner la vulnerabilidad en ese mensaje**.

Nunca le pedimos a quien reporta que entregue contraseñas, tokens de acceso, credenciales de pago ni datos personales que no hagan falta para reproducir el problema.

### Qué incluir

- Una descripción concisa del problema, su impacto y qué tan grave te parece.
- El componente, entorno, versión de la app o commit afectado.
- Pasos para reproducirlo y una prueba de concepto mínima que use solo cuentas, negocios y datos tuyos o que tengas autorización para probar.
- Peticiones, respuestas, registros o capturas saneadas — sin secretos ni datos personales.
- Cualquier mitigación que conozcas, y si querés crédito público (y cómo).

### Qué esperar

Estos son **objetivos, no plazos garantizados**. Pueden moverse según la explotabilidad, el impacto en clientes, la complejidad de la corrección y las restricciones de una publicación coordinada.

| Etapa | Objetivo |
| --- | --- |
| Acuse de recibo | Dentro de **3 días hábiles** |
| Triage inicial y evaluación de severidad | Dentro de **10 días hábiles** |
| Crítico: mitigación o corrección | **7 días calendario** después de validar |
| Alto: mitigación o corrección | **30 días calendario** después de validar |
| Medio: mitigación o corrección | **90 días calendario** después de validar |
| Bajo | Mejor esfuerzo |

La explotación activa, las amenazas a la seguridad de las personas, la exposición de información sensible, la integridad de los pedidos y la corrección financiera van primero. Si una corrección completa tarda más, podemos aplicar una mitigación temporal y contarte el plan revisado en privado.

### Qué queda dentro del alcance

Sobre activos que PymesHub posee u opera:

- las aplicaciones **web** y **iOS/Android** activas, las sesiones y la recuperación de cuenta;
- la **API** activa — autenticación, autorización y los límites de rol entre clientes, dueños y staff de negocios, repartidores, soporte y administradores;
- el **aislamiento entre negocios**, el acceso no autorizado a datos privados de otro negocio y las referencias directas inseguras a objetos;
- la **integridad de productos e inventario**, los cálculos del carrito y del checkout, los costos de entrega, las promociones y quién puede mover un pedido a qué estado;
- la **lógica de negocio de pagos donde exista** — teniendo en cuenta que el marketplace cobra contra entrega (efectivo o SINPE Móvil) y **no** tiene un flujo de tarjeta en línea;
- la **asignación y el seguimiento de entregas**, la divulgación no autorizada de ubicación, las direcciones de clientes, los datos de repartidores y la información personal ligada a un pedido;
- las **subidas y el acceso a medios**, los permisos de almacenamiento, el procesamiento de eventos y webhooks, los secretos expuestos y la configuración de la nube.

Una vulnerabilidad en **cómo nuestra aplicación integra** un servicio de terceros está dentro del alcance. Probar o atacar el servicio de terceros en sí no lo está.

### Qué queda fuera del alcance

- Ingeniería social, phishing, ataques físicos y ataques contra infraestructura de terceros.
- Denegación de servicio, pruebas de estrés y de carga, agotamiento de recursos, o cualquier cosa que degrade materialmente la disponibilidad.
- Pruebas destructivas, spam, creación masiva de cuentas, o contactar clientes, negocios o repartidores sin permiso.
- Salida cruda de escáneres automáticos, observaciones genéricas de buenas prácticas y cabeceras faltantes sin impacto de seguridad demostrado.
- Componentes retirados que no están desplegados, salvo que expongan un riesgo real al producto soportado.

### Reglas para probar

- Usá solo cuentas, negocios, dispositivos y datos tuyos o con permiso explícito.
- **Nunca accedas, cambies, retengas ni extraigas intencionalmente datos de otra persona o negocio.** Si te los encontrás por accidente, pará, no recojas más y reportalo en privado cuanto antes.
- No generes pedidos, entregas, reembolsos, pagos ni cobros reales sin autorización previa. Usá datos de prueba y un entorno que no sea de producción cuando exista.
- No saltees límites de tasa con tráfico masivo ni degradés el servicio. Sin persistencia, sin malware, sin movimiento lateral y sin llegar a infraestructura que no tengas autorizada.
- Recogé la evidencia mínima necesaria para demostrar el impacto, y quitá datos personales y secretos antes de enviarla.
- Pará de probar cuando tengas evidencia suficiente, y danos tiempo para corregir.

### Divulgación coordinada, crédito y avisos

- Danos una oportunidad razonable de investigar, mitigar y publicar una corrección antes de difundir detalles técnicos. **Coordinamos el calendario con vos** en vez de exigir un embargo indefinido.
- Cuando corresponde, los avisos verificados se publican a través de los **avisos de seguridad de GitHub** del repositorio.
- El formato de identificador propuesto es **`OTL-SA-AAAA-NNN`** (por ejemplo `OTL-SA-2026-001`). Un identificador se asigna **solo a un aviso realmente publicado**. PymesHub también podría publicar avisos en este sitio una vez que esa página esté operativa y verificada — todavía no está activa.
- Quien reporta puede pedir crédito público o anonimato. Lo que se encuentra internamente se acredita como **Reportado por PymesHub Security**.

**Avisos publicados: ninguno todavía.** Cuando haya uno, aparece acá con su identificador, su severidad, las versiones afectadas, la versión corregida y el crédito.

### Puerto seguro

Apoyamos la investigación de buena fe hecha dentro de este alcance y estas reglas. Para la investigación que podemos autorizar legalmente, PymesHub no tiene intención de iniciar acciones legales únicamente por pruebas conformes y un reporte privado.

Esto no se extiende a sistemas de terceros, conductas ilícitas, violaciones de privacidad, interrupciones deliberadas ni nada fuera de nuestro control, y no reemplaza la ley aplicable ni obliga a terceros.

### Lo que esta página no afirma

- La política de seguridad autoritativa es el `SECURITY.md` del repositorio, y **está en proceso de actualización para coincidir con esta página** — la versión alineada al marketplace está preparada y esperando su publicación. Mientras existan las dos, los objetivos de arriba son los que trabajamos, y si el archivo del repositorio declara un compromiso más corto para alguna etapa, aplica ese más corto.
- El esquema de identificadores y una página de avisos propia en el sitio están **propuestos, no activos**; hoy los avisos se publican por los avisos de seguridad de GitHub.
- Ninguna medida de seguridad es absoluta, y esta página no genera ninguna garantía.
