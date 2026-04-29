# Trust Center de PymesHub

Última actualización: [FECHA]

## 1. Propósito del Trust Center

El Trust Center es la puerta de entrada al material de confianza, seguridad y cumplimiento de PymesHub. Concentra en un solo lugar las referencias que equipos de procurement, IT, seguridad, compliance y liderazgo necesitan para evaluar la Plataforma antes del rollout, durante la operación y en procesos de revisión continua.

No reemplaza los documentos contractuales, pero ofrece una vista consolidada, actualizada y transparente de la postura de seguridad, privacidad, disponibilidad y gobernanza de PymesHub.

## 2. Estructura del Trust Center

### 2.1 Seguridad de la Plataforma

| Área | Documento | Contenido |
|------|-----------|-----------|
| Control de acceso | Política de Control de Acceso | Roles OWNER, ADMIN, AGENT, VIEWER; accesos internos, temporales y de soporte; revisiones periódicas |
| Seguridad general | Política de Seguridad | Principios de menor privilegio, segregación multi-tenant, manejo de secretos, logging, vendors |
| Incidentes | Respuesta a Incidentes | Detección, clasificación SEV-1 a SEV-4, contención, investigación, comunicación a clientes |
| Desarrollo seguro | Secure Development Policy | SDLC, revisión de código, manejo de dependencias, secretos en repositorios |

### 2.2 Privacidad y datos

| Área | Documento | Contenido |
|------|-----------|-----------|
| Privacidad | Política de Privacidad | Categorías de datos, finalidades, base legal, derechos ARCO, contacto de privacidad |
| Encargo de tratamiento | Data Processing Addendum | Instrucciones, subencargados, seguridad, notificación de brechas, retorno o supresión |
| Retención | Retención y Eliminación | Criterios de retención por categoría, anonimización, borrado físico y copias residuales |
| Subencargados | Aviso de Subencargados | Lista pública de terceros con función, datos tratados y región |

### 2.3 Operación y disponibilidad

| Área | Documento | Contenido |
|------|-----------|-----------|
| Disponibilidad | SLA Base | Objetivo mensual de disponibilidad, mantenimientos, exclusiones, incidentes críticos |
| Soporte | Política de Soporte | Canales, prioridades P1-P4, tiempos orientativos, escalamiento, exclusiones |
| Lanzamiento | Guía de Lanzamiento | Checklist pre-go-live, roles, canales, handoffs, referencias |

### 2.4 Cumplimiento y gobernanza

| Área | Documento | Contenido |
|------|-----------|-----------|
| Términos | Términos de Servicio | Acceso, licencia, pagos, suspensión, responsabilidad, ley aplicable |
| AUP | Política de Uso Aceptable | Conductas prohibidas, reglas WhatsApp e IA, consecuencias |
| Auditoría | Audit Logging | Eventos mínimos auditables, actor, workspace, objeto, timestamp |
| Aceptación | Aceptación Legal en Producto | Registro documental versionado, re-aceptación, evidencia técnica |

## 3. Controles de seguridad

PymesHub aplica controles administrativos, físicos y lógicos proporcionados al riesgo:

- **Control de acceso**: autenticación segura con JWT, refresh tokens rotativos, RBAC por rol, sesiones con expiración configurable, 2FA disponible.
- **Cifrado**: TLS 1.3 en tránsito para todas las comunicaciones; cifrado en reposo para bases de datos, almacenamiento de archivos y backups.
- **Aislamiento**: segregación lógica multi-tenant con filtrado obligatorio por workspace en cada consulta a base de datos y almacenamiento.
- **Monitoreo y logging**: registro centralizado de eventos de seguridad, errores, accesos y cambios de configuración, con retención mínima de 90 días.
- **Gestión de vulnerabilidades**: escaneo periódico de dependencias, revisión de secretos expuestos, actualización programada de librerías y parches de seguridad.
- **Respaldos**: backups diarios automatizados, almacenados en región separada, con pruebas de restauración periódicas.
- **Capacitación**: personal con acceso a producción recibe entrenamiento en seguridad, privacidad y manejo de incidentes.

## 4. Respuesta a incidentes

- **Detección**: monitoreo automatizado de disponibilidad, errores y anomalías con alertas al equipo de operaciones.
- **Clasificación**: severidades SEV-1 (crítico) a SEV-4 (informativo) según impacto en disponibilidad, seguridad y datos.
- **Contención**: activación inmediata del equipo de respuesta, aislamiento del componente afectado y preservación de evidencia.
- **Investigación**: análisis de causa raíz, evaluación de alcance y determinación de datos potencialmente comprometidos.
- **Notificación**: comunicación a clientes afectados sin demora indebida. Para brechas que involucren datos personales, notificación dentro de los plazos legales aplicables.
- **Cierre**: documentación del incidente, lecciones aprendidas, mejoras preventivas y actualización de playbooks.

## 5. Cumplimiento normativo

PymesHub diseña su marco de cumplimiento alineado con:

- **Ley N.º 8968** de Protección de la Persona frente al Tratamiento de sus Datos Personales (Costa Rica) y su Reglamento Decreto Ejecutivo N.º 37554-JP.
- **Ley N.º 8454** de Certificados, Firmas Digitales y Documentos Electrónicos (Costa Rica).
- **Ley N.º 7472** de Promoción de la Competencia y Defensa Efectiva del Consumidor (Costa Rica) y su Reglamento.
- **Buenas prácticas internacionales** tipo GDPR en transferencias internacionales, subencargados, notificación de brechas y derechos de titulares.
- **Políticas contractuales** de proveedores externos: OpenAI, Anthropic, Google Cloud, Meta/WhatsApp y Paddle.

## 6. Evaluación de proveedores

Cada proveedor externo que trata datos por cuenta de PymesHub o de sus clientes pasa por:

- Revisión contractual con obligaciones de confidencialidad, seguridad y limitación de finalidad.
- Evaluación de medidas de seguridad y certificaciones aplicables.
- Verificación de región de tratamiento y mecanismos de transferencia internacional.
- Compromiso de notificación de incidentes y cooperación en derechos de titulares.
- Inclusión en la lista pública de subencargados con derecho de objeción del cliente.

## 7. Reportes y certificaciones

Durante la etapa beta y acceso anticipado, PymesHub opera bajo políticas internas documentadas y controles verificables. Según evolucione el producto y las necesidades de clientes enterprise, se evaluará la obtención de certificaciones formales o auditorías externas.

Actualmente, los siguientes materiales están disponibles públicamente:

- Políticas de seguridad, control de acceso, respuesta a incidentes, respaldos y retención.
- Documentación legal completa: Términos, Privacidad, DPA, AUP, Facturación, Cookies, WhatsApp/IA, Subencargados.
- SLA base y política de soporte operativo.

## 8. Contacto

Para consultas de seguridad, cumplimiento o procurement:

- Correo: [CORREO_LEGAL]
- Tiempo de respuesta: dentro del horario laboral de Costa Rica, con priorización para temas de seguridad y cumplimiento.
- Procesos formales de revisión: pueden solicitarse por correo y se atenderán según disponibilidad y alcance del requerimiento.
