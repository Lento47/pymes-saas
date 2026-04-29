# Guía de Lanzamiento de Workspace

Última actualización: [FECHA]

## 1. Objetivo

Esta guía proporciona una ruta clara para que equipos nuevos activen su workspace de PymesHub con la estructura, roles, canales y documentación necesaria para operar desde el primer día.

## 2. Antes de empezar

Antes de crear el workspace, asegúrate de tener definido lo siguiente:

- **Dueño del workspace**: persona con autoridad para decidir roles, accesos, plan y facturación. Normalmente liderazgo o fundador.
- **Equipo inicial**: al menos 2-3 personas que usarán la Plataforma en el día a día (ventas, soporte, finanzas, operaciones).
- **Canales activos**: define cuáles canales de comunicación usarás primero (WhatsApp, correo) y si ya tienes números o direcciones configurados.
- **Flujo de trabajo deseado**: entiende cómo se mueve una conversación típica en tu negocio —desde el primer contacto hasta la factura pagada— para configurar el workspace de forma coherente.
- **Expectativas del cliente**: revisa los documentos de confianza aplicables para tu equipo y, si corresponde, compártelos con stakeholders internos antes del go-live.

## 3. Paso 1 — Crear el workspace

1. Accede a [URL_PLATAFORMA] y selecciona «Crear workspace».
2. Define el slug del workspace (identificador único, por ejemplo `mi-empresa`).
3. Proporciona el nombre comercial visible para tu equipo.
4. Configura el idioma predeterminado del workspace (español / inglés).

## 4. Paso 2 — Configurar roles y accesos

Invita a los miembros del equipo inicial y asigna el rol correcto desde el principio:

| Rol | Acceso |
|-----|--------|
| **OWNER** | Control total: configuración, facturación, miembros, roles, canales, eliminación de datos. Normalmente una sola persona. |
| **ADMIN** | Administración operativa: canales, departamentos, miembros con rol AGENT o VIEWER, automatizaciones. No puede cambiar de OWNER ni eliminar el workspace. |
| **AGENT** | Operación diaria: gestionar conversaciones, contactos, tareas, documentos, facturas y pipeline. |
| **VIEWER** | Solo lectura: ver bandeja, contactos, pipeline e informes sin modificar datos. |

**Recomendación**: empieza con un OWNER, un ADMIN y los AGENTS necesarios. Añade VIEWERS solo cuando necesites visibilidad sin capacidad de edición.

## 5. Paso 3 — Configurar canales

### 5.1 WhatsApp

1. Conecta tu número de WhatsApp Business a través de la integración en Configuración > Canales.
2. Configura las plantillas de mensaje necesarias para iniciar conversaciones (recordatorios, bienvenida, seguimiento).
3. Asegúrate de contar con el opt-in de tus clientes antes de enviar mensajes proactivos.
4. Revisa la Política de WhatsApp e IA de PymesHub para entender las obligaciones del canal.

### 5.2 Correo electrónico

1. Configura la bandeja de correo unificada en Configuración > Canales.
2. Define reglas de enrutamiento: qué mensajes van a qué departamento o agente.
3. Si usas un dominio propio, configura los registros DNS necesarios (SPF, DKIM, DMARC).

## 6. Paso 4 — Organizar departamentos

Crea departamentos que reflejen la estructura real de tu operación:

- **Ventas**: prospectos, cotizaciones, pipeline, cierre de negocios.
- **Soporte**: dudas, incidencias, seguimiento post-venta.
- **Finanzas**: facturación, cobros, conciliación, notas de crédito.
- **Operaciones**: onboarding, documentación, procesos internos.

Cada departamento puede tener reglas de enrutamiento automático y SLAs internos de respuesta.

## 7. Paso 5 — Configurar pipeline

1. Define las etapas de tu proceso comercial en Configuración > Pipeline.
2. Etapas sugeridas: Nuevo Lead → Calificado → Propuesta Enviada → Negociación → Cerrado Ganado / Perdido.
3. Asigna responsables y tiempos esperados por etapa.
4. Configura automatizaciones para mover leads entre etapas o crear tareas al cambiar de fase.

## 8. Paso 6 — Revisar documentación de confianza

Antes del go-live, asegúrate de que tu equipo y stakeholders conozcan los siguientes materiales:

- **Términos de Servicio**: rigen la relación contractual. Deben ser aceptados al crear la cuenta.
- **Política de Privacidad**: explica cómo PymesHub trata datos personales propios del servicio.
- **Data Processing Addendum**: regula el tratamiento de los datos que cargas en la Plataforma.
- **SLA Base**: define expectativas de disponibilidad y manejo de incidentes.
- **Política de Soporte**: canales, prioridades y tiempos orientativos de atención.
- **Aviso de Subencargados**: terceros que pueden tratar datos en la cadena del servicio.

## 9. Paso 7 — Activar el workspace

1. Revisa que todos los miembros invitados hayan aceptado y configurado su acceso.
2. Verifica que los canales estén recibiendo mensajes correctamente.
3. Realiza una prueba de flujo completo: mensaje entrante → asignación → respuesta → tarea o factura → cierre.
4. Confirma que las automatizaciones disparen correctamente (recordatorios, handoffs, notificaciones).
5. Activa el workspace para producción.

## 10. Post-lanzamiento

### Semana 1
- Monitorea los primeros mensajes y handoffs.
- Corrige enrutamiento o asignaciones si es necesario.
- Confirma que los tiempos de respuesta se alinean con tus expectativas.

### Primer mes
- Revisa el pipeline y ajusta etapas según datos reales.
- Evalúa si necesitas nuevos roles, departamentos o canales.
- Programa un checkpoint con el equipo para recoger feedback.

### Trimestral
- Revisa la lista de miembros y elimina accesos inactivos.
- Actualiza automatizaciones según nuevos patrones de operación.
- Revisa los documentos de subencargados y legales por si hubo cambios materiales.
- Ejecuta una exportación de datos si tu política interna lo requiere.

## 11. Referencias rápidas

| Necesidad | Recurso |
|-----------|---------|
| Problema técnico | Política de Soporte — canal y prioridad |
| Incidente de seguridad | Reportar a [CORREO_SEGURIDAD] |
| Cambio de plan o facturación | Configuración > Facturación |
| Nuevo miembro del equipo | Configuración > Miembros > Invitar |
| Revisión de cumplimiento | Trust Center y Centro Legal |
| Exportación de datos | Soporte o funcionalidad de exportación del workspace |
