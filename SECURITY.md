# Security Policy / Política de Seguridad

- [English](#english)
- [Español](#español)

---

## English

PymesHub is a local-commerce and delivery marketplace connecting customers, merchants, and couriers. It includes a React web application, an Expo/React Native application for iOS and Android, and a Cloudflare Workers API (Hono/tRPC). The NestJS application retained in the repository is legacy code, not the active marketplace API.

We take the confidentiality, integrity, and availability of customer information, merchant data, orders, delivery information, and marketplace operations seriously. We welcome responsible, good-faith vulnerability reports.

### Supported Versions

| Component / version | Security support |
| --- | --- |
| Current production web application and API | ✅ Supported |
| Current supported iOS and Android releases | ✅ Supported |
| Latest commit on the default branch | ✅ Maintained; not necessarily deployed |
| Older releases, builds, and unmaintained legacy code | ❌ Not routinely supported |

Critical issues affecting older clients may still require mitigations, a forced upgrade, or server-side protection. The current production deployment and supported app-store releases determine what is actively supported.

### Reporting a Vulnerability

**Do not report security vulnerabilities in public GitHub issues, pull requests, discussions, reviews, or social media.**

1. **Preferred:** Use [GitHub Private Vulnerability Reporting](https://github.com/Lento47/pymes-saas/security) via **Security → Report a vulnerability**, if that option is available.
2. **Alternative:** Email **security@pymeshub.com** using the contact address listed in the previous security policy.

<!-- Maintainers: before merging, confirm that Private Vulnerability Reporting is enabled and security@pymeshub.com is actively monitored. Replace the fallback email if necessary. -->

If neither channel works, do not disclose exploit details publicly. Contact a repository maintainer through a non-sensitive channel to request a secure reporting method without sending the vulnerability details.

We do not ask reporters to submit passwords, access tokens, payment credentials, or unnecessary personal data.

### What to Include

- A concise description of the vulnerability, its impact, and likely severity
- The affected component, environment, app version, or commit
- Reproduction steps and a minimal proof of concept using only accounts, merchant entities, and data you own or are authorized to test
- Relevant sanitized requests, responses, logs, or screenshots (with secrets and personal data removed)
- Any known mitigations or suggested remediation
- Whether and how you wish to be credited

### Response Targets

The following are **targets, not guaranteed resolution deadlines**. They may change with exploitability, customer impact, remediation complexity, and coordinated release constraints.

| Stage | Target |
| --- | --- |
| Acknowledge report | Within 3 business days |
| Initial triage and severity assessment | Within 10 business days |
| Critical: mitigation or fix | Target within 7 calendar days after validation |
| High: mitigation or fix | Target within 30 calendar days after validation |
| Medium: mitigation or fix | Target within 90 calendar days after validation |
| Low: mitigation or fix | Best effort |

We prioritize active exploitation and threats to user safety, sensitive information, order integrity, and financial correctness. If a full fix takes longer, we may use temporary mitigations and communicate a revised plan privately.

### Scope

**In scope** (for PymesHub-owned or PymesHub-operated assets):

- Active React web and Expo iOS/Android applications, authenticated sessions, and account recovery
- Active Cloudflare Workers API, authentication, authorization, and role boundaries for customers, merchant owners/staff, couriers, support, and administrators
- Merchant and location isolation, unauthorized access to other merchants' private data, and insecure direct object references
- Product and inventory integrity, cart/checkout calculations, delivery fees, promotions, and order-state authorization
- Payment and settlement **business logic where implemented**; PymesHub currently describes its marketplace checkout as **cash/payment on delivery**, not an online card-processing flow
- Delivery assignment and tracking, unauthorized location disclosure, customer addresses, courier details, and order-related personal information
- PymesHub-controlled uploads, media access, storage permissions, webhook/event processing, secrets exposure, and cloud-service configuration

A vulnerability in how **our application integrates** a third-party service is in scope. Testing or attacking the third-party service itself is not authorized by this policy.

**Out of scope:**

- Social engineering, phishing, physical attacks, and attacks against third-party infrastructure
- Denial-of-service, stress/load testing, resource exhaustion, or tests that materially degrade availability
- Destructive testing, spam, mass account creation, or unsolicited contact with customers, merchants, or couriers
- Automated scanner output, generic best-practice observations, or missing headers without a demonstrated security impact
- Unmaintained legacy components that are not deployed, unless they expose an actual risk to the supported product

### Testing Rules

- Use only accounts, merchants, devices, and data you own or have explicit permission to use.
- **Never intentionally access, change, retain, or exfiltrate another user's or merchant's data.** If you inadvertently encounter it, stop, do not collect more, and report promptly using a private channel.
- Do not initiate real transactions, deliveries, refunds, payouts, or charges without explicit prior authorization. Use safe test data and non-production environments where available.
- Do not bypass rate limits through high-volume traffic or degrade services. Avoid persistence, malware, lateral movement, and access to infrastructure not explicitly authorized.
- Collect only the minimum evidence needed to demonstrate impact; remove personal data and secrets before submitting it.
- Stop testing once sufficient evidence is obtained and allow time for coordinated remediation.

### Coordinated Disclosure and Advisories

Please give us a reasonable opportunity to investigate, mitigate, and release a fix before publishing technical details. We will coordinate a disclosure timeline with the reporter rather than require an indefinite embargo.

When appropriate, verified advisories will be published through [GitHub Security Advisories](https://github.com/Lento47/pymes-saas/security/advisories). PymesHub may also publish advisories at https://pymeshub.lat/advisory/security **once that endpoint is operational and verified**.

The proposed identifier format is **OTL-SA-YYYY-NNN** (for example, OTL-SA-2026-001). Identifiers are assigned only to actual published advisories; this example is not an advisory.

Reporters may request public credit or anonymity. Internal reports may be credited as **Reported by PymesHub Security**.

### Safe Harbor

We support good-faith research conducted within this policy's scope and rules. For research we can lawfully authorize, PymesHub does not intend to pursue legal action solely for compliant security testing and private reporting. This authorization does **not** extend to third-party systems, unlawful conduct, privacy violations, deliberate disruption, or acts outside our control. This statement does not override applicable law or bind third parties.

---

## Español

PymesHub es un marketplace de comercio local y entregas que conecta clientes, comercios y repartidores. Incluye una aplicación web en React, una aplicación móvil Expo/React Native para iOS y Android y una API activa en Cloudflare Workers (Hono/tRPC). La aplicación NestJS conservada en el repositorio es código legado y no es la API activa del marketplace.

Nos tomamos en serio la confidencialidad, integridad y disponibilidad de los datos de clientes y comercios, los pedidos, la información de entregas y las operaciones del marketplace. Agradecemos los reportes responsables y de buena fe.

### Versiones Soportadas

| Componente / versión | Soporte de seguridad |
| --- | --- |
| Aplicación web y API actuales en producción | ✅ Soportadas |
| Versiones vigentes de iOS y Android con soporte | ✅ Soportadas |
| Último commit de la rama principal | ✅ Mantenido; no necesariamente desplegado |
| Versiones antiguas y código legado sin mantenimiento | ❌ Sin soporte habitual |

Las vulnerabilidades críticas en clientes antiguos pueden requerir mitigaciones, actualizaciones obligatorias o protección del lado del servidor. El despliegue actual y las versiones móviles vigentes determinan el soporte activo.

### Cómo Reportar una Vulnerabilidad

**No publique vulnerabilidades en issues, pull requests, discusiones, revisiones de GitHub ni redes sociales.**

1. **Preferido:** Utilice el [reporte privado de vulnerabilidades de GitHub](https://github.com/Lento47/pymes-saas/security) mediante **Security → Report a vulnerability**, si la opción está disponible.
2. **Alternativa:** Escriba a **security@pymeshub.com**, dirección indicada en la política de seguridad anterior.

<!-- Mantenedores: antes de fusionar, confirmar que GitHub Private Vulnerability Reporting esté habilitado y que security@pymeshub.com sea un buzón supervisado. Sustituir la dirección si corresponde. -->

Si ninguno de los canales funciona, no publique los detalles técnicos. Solicite a una persona responsable del repositorio un método privado de contacto, sin compartir la vulnerabilidad en ese mensaje.

No solicitamos contraseñas, tokens, datos de tarjetas ni información personal innecesaria.

### Qué Incluir

- Descripción breve de la vulnerabilidad, impacto y severidad estimada
- Componente, entorno, versión de la aplicación o commit afectado
- Pasos de reproducción y prueba de concepto mínima usando solo cuentas, comercios y datos propios o autorizados
- Solicitudes, respuestas, registros o capturas depurados, sin secretos ni datos personales
- Mitigaciones conocidas o correcciones sugeridas
- Preferencia de crédito público o anonimato

### Objetivos de Respuesta

Los siguientes son **objetivos y no garantías de resolución**. Pueden variar por explotación activa, impacto, complejidad o restricciones de publicación de versiones.

| Etapa | Objetivo |
| --- | --- |
| Acuse de recibo | Dentro de 3 días hábiles |
| Triaje inicial y evaluación de severidad | Dentro de 10 días hábiles |
| Crítica: mitigación o corrección | Objetivo de 7 días naturales tras validación |
| Alta: mitigación o corrección | Objetivo de 30 días naturales tras validación |
| Media: mitigación o corrección | Objetivo de 90 días naturales tras validación |
| Baja: mitigación o corrección | Según disponibilidad |

Se priorizan vulnerabilidades explotadas activamente y riesgos para los usuarios, datos sensibles, integridad de pedidos y exactitud financiera. Si una corrección completa requiere más tiempo, podremos aplicar medidas temporales y comunicar un plan actualizado en privado.

### Alcance

**Dentro del alcance** (activos propios u operados por PymesHub):

- Aplicaciones activas web React y móviles Expo para iOS/Android; sesiones y recuperación de cuentas
- API activa en Cloudflare Workers; autenticación, autorización y permisos de clientes, propietarios/personal de comercios, repartidores, soporte y administradores
- Aislamiento entre comercios y sucursales, accesos indebidos a datos privados y referencias directas inseguras a objetos
- Integridad de catálogos e inventario, cálculos de carrito/checkout, tarifas de entrega, promociones y autorización de transiciones de pedidos
- Lógica de pagos y liquidaciones **cuando esté implementada**; actualmente el flujo descrito para PymesHub utiliza **pago contra entrega**, no procesamiento de tarjetas en línea
- Asignación y seguimiento de entregas, exposición no autorizada de ubicación, direcciones y datos personales de clientes y repartidores
- Cargas de archivos, medios, permisos de almacenamiento, webhooks/eventos, exposición de secretos y configuraciones en la nube bajo control de PymesHub

Las fallas en **nuestra integración** con terceros están dentro del alcance. Esta política no autoriza pruebas contra la infraestructura propia de esos proveedores.

**Fuera del alcance:**

- Ingeniería social, phishing, ataques físicos y ataques a infraestructura de terceros
- Denegación de servicio, pruebas de carga/estrés, agotamiento de recursos o degradación significativa del servicio
- Pruebas destructivas, spam, creación masiva de cuentas o contacto no solicitado a clientes, comercios o repartidores
- Resultados automáticos de escáneres, recomendaciones genéricas o cabeceras faltantes sin impacto de seguridad demostrado
- Componentes legados sin mantenimiento y fuera de producción, salvo que generen un riesgo real para el producto soportado

### Reglas de Prueba

- Use solo cuentas, comercios, dispositivos y datos propios o expresamente autorizados.
- **Nunca acceda deliberadamente, modifique, conserve ni extraiga datos ajenos.** Si los encuentra accidentalmente, deténgase, no recopile más información y repórtelo en privado cuanto antes.
- No genere transacciones, entregas, reembolsos, desembolsos ni cargos reales sin autorización previa explícita. Prefiera datos de prueba y entornos no productivos cuando existan.
- No eluda límites mediante tráfico masivo ni degrade servicios. Evite persistencia, malware, movimiento lateral y acceso a infraestructura no autorizada.
- Recopile solo la evidencia mínima necesaria y elimine secretos o datos personales de los reportes.
- Detenga las pruebas cuando exista evidencia suficiente y permita coordinar la corrección.

### Divulgación Coordinada y Avisos

Solicitamos una oportunidad razonable para investigar, mitigar y publicar la corrección antes de divulgar detalles técnicos. Coordinaremos una fecha de publicación con quien reporte, sin imponer un embargo indefinido.

Los avisos verificados se publicarán, cuando corresponda, en [GitHub Security Advisories](https://github.com/Lento47/pymes-saas/security/advisories). También podrán publicarse en https://pymeshub.lat/advisory/security **cuando ese sitio esté operativo y verificado**.

El formato propuesto de identificadores es **OTL-SA-YYYY-NNN** (por ejemplo, OTL-SA-2026-001). Solo se asignarán identificadores a avisos realmente publicados; el ejemplo no representa un aviso.

Los reportantes pueden elegir crédito público o anonimato. Los hallazgos internos pueden acreditarse como **Reportado por PymesHub Security**.

### Puerto Seguro (Safe Harbor)

Apoyamos la investigación de buena fe realizada dentro de las reglas y el alcance de esta política. Respecto de las investigaciones que PymesHub pueda autorizar legalmente, no pretendemos iniciar acciones legales únicamente por pruebas conformes con esta política y reportes privados. Esta autorización **no** cubre sistemas de terceros, conductas ilícitas, violaciones de privacidad, interrupciones intencionales ni acciones fuera de nuestro control. Esta declaración no sustituye la ley aplicable ni obliga a terceros.
