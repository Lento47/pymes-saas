# Prompts para generar más contenido

Esta página contiene prompts listos para usar con cualquier IA (Claude, ChatGPT, Gemini) para crear documentación adicional, tutoriales, artículos de blog o contenido de marketing sobre PymeHub.

## Contexto base (incluir siempre)

Copia este bloque de contexto al inicio de cualquier prompt para que la IA entienda qué es PymeHub:

```
# Contexto: PymeHub

PymeHub es una plataforma SaaS B2B multi-tenant para PyMEs hispanohablantes 
(especialmente Costa Rica). Es una plataforma operativa todo-en-uno que centraliza:

## Funcionalidades principales
- Inbox unificado (Email + WhatsApp) — gestión de conversaciones con clientes
- CRM de Contactos (clientes, proveedores, leads)
- Gestión de Tareas con deadlines, prioridades y asignación por equipo
- Documentos con OCR automático
- Automatizaciones (reglas: trigger + condiciones + acciones, sin código)
- Insights IA — análisis mes a mes con alertas accionables en español
- Resúmenes diarios IA en español
- Facturación con integración Hacienda (CR) para factura electrónica
- Pipeline de Ventas (Kanban de deals)
- Notificaciones en tiempo real (WebSockets)

## Tecnologías
- Backend: NestJS + PostgreSQL + Redis + BullMQ
- Frontend: React 18 + TypeScript + Tailwind CSS + Radix UI
- Desktop: Tauri 2 (Windows nativo)
- IA: OpenAI, Anthropic (Claude), Google Gemini

## Audiencia objetivo
Dueños y gerentes de PyMEs que quieren centralizar su operación en una sola 
herramienta sin necesidad de Slack + HubSpot + Excel + email separados.

## Propuesta de valor
"Tu socio inteligente que te dice exactamente qué ajustar en tu negocio, 
basado en datos."

## Planes
- Free: 3 usuarios, 100 MB, 2 canales, 3 automatizaciones
- Starter: 10 usuarios, 5 GB, 5 canales, 10 automatizaciones  
- Growth: 25 usuarios, 50 GB, 10 canales, automatizaciones ilimitadas
- Enterprise: todo ilimitado, soporte dedicado

## Idioma y tono
Español latinoamericano, tono profesional pero cercano. 
Sin jerga técnica innecesaria. Orientado a dueños de negocio, no a técnicos.
```

---

## Prompts de documentación

### Crear una guía paso a paso

```
[CONTEXTO PYMEHUB ARRIBA]

Crea una guía práctica paso a paso sobre cómo [TEMA] en PymeHub.

Requisitos:
- Máximo 800 palabras
- Formato: título H1, secciones H2, pasos numerados con código cuando aplique
- Incluir: qué necesitas antes de empezar, pasos detallados, resultado esperado
- Tono: como si le explicaras a un dueño de negocio no técnico
- Incluir al menos un tip o advertencia relevante

Tema: [ej: "configurar automatizaciones para asignar WhatsApp a ventas"]
```

### Crear página de preguntas frecuentes (FAQ)

```
[CONTEXTO PYMEHUB ARRIBA]

Crea una sección de FAQ sobre [MÓDULO] con 8-10 preguntas y respuestas.

Formato:
- Pregunta en negrita
- Respuesta de 2-4 oraciones, directa y clara
- Usa lenguaje de un dueño de negocio, no de un desarrollador

Módulo: [ej: "Inbox y gestión de conversaciones"]
```

### Documentar un endpoint de API

```
[CONTEXTO PYMEHUB ARRIBA]

La API de PymeHub tiene el siguiente endpoint:
[PEGA AQUÍ LA INFORMACIÓN DEL ENDPOINT]

Crea la documentación de este endpoint en formato técnico que incluya:
- Descripción en 1-2 oraciones
- URL y método HTTP
- Headers requeridos
- Parámetros con nombre, tipo y descripción
- Ejemplo de request (cURL y JSON)
- Ejemplo de respuesta exitosa (JSON)
- Códigos de error posibles
- Notas o advertencias si aplican

Idioma: español
```

### Explicar un concepto técnico de forma simple

```
[CONTEXTO PYMEHUB ARRIBA]

Explica el concepto de [CONCEPTO] de PymeHub de manera que lo entienda 
un dueño de negocio sin conocimientos técnicos.

Requisitos:
- Máximo 300 palabras
- Usa una analogía del mundo de los negocios
- Explica: qué es, por qué importa, cómo lo usas
- Evita términos técnicos. Si debes usarlos, explícalos

Concepto: [ej: "webhooks", "multi-tenancy", "automatizaciones", "OCR"]
```

---

## Prompts de marketing y ventas

### Artículo de blog

```
[CONTEXTO PYMEHUB ARRIBA]

Escribe un artículo de blog de 600-800 palabras sobre el siguiente tema 
para el sitio web de PymeHub.

El artículo debe:
- Empezar con un problema real que enfrenta el dueño de PyME
- Explicar cómo PymeHub ayuda a resolverlo (sin ser demasiado publicitario)
- Incluir 2-3 ejemplos prácticos con nombres ficticios de empresas CR/LATAM
- Terminar con un CTA suave (ej: "Prueba gratis por 14 días")
- Estar optimizado para SEO con la palabra clave mencionada 2-3 veces naturalmente

Tema del artículo: [ej: "Por qué las PyMEs de Costa Rica pierden clientes por mala comunicación"]
Palabra clave SEO: [ej: "gestión de clientes para PyMEs Costa Rica"]
```

### Email de onboarding

```
[CONTEXTO PYMEHUB ARRIBA]

Escribe un email de onboarding para nuevos usuarios de PymeHub que acaban 
de crear su cuenta.

El email debe:
- Tener asunto atractivo (máximo 50 caracteres)
- Ser cálido y de bienvenida, no frío ni corporativo
- Durar máximo 2 minutos de lectura
- Incluir 3 primeras acciones que debe tomar (con links ficticios)
- Terminar con oferta de ayuda (soporte)
- Firma: "El equipo de PymeHub"

Contexto: es el primer email que recibe el usuario, 5 minutos después de registrarse
```

### Comparativa de producto (vs. herramientas por separado)

```
[CONTEXTO PYMEHUB ARRIBA]

Crea una comparativa de por qué PymeHub es mejor que usar estas herramientas 
por separado: [WhatsApp Web + HubSpot gratuito + Trello + Google Drive + Excel].

Formato: tabla comparativa + párrafo de conclusión
Enfasis en: costo total, tiempo perdido cambiando herramientas, falta de visión unificada
Tono: directo, honesto, no agresivo hacia las otras herramientas
```

### Caso de uso por industria

```
[CONTEXTO PYMEHUB ARRIBA]

Crea un caso de uso detallado de cómo una empresa del sector [SECTOR] 
usaría PymeHub en su operación diaria.

Incluye:
- Nombre y descripción ficticia de la empresa (5-10 empleados, CR o LATAM)
- Problemas que tenían antes de PymeHub
- Cómo usan cada módulo relevante (Inbox, CRM, Tareas, Automatizaciones)
- Resultados obtenidos (con números estimados realistas)
- Una cita ficticia del dueño de la empresa

Longitud: 400-500 palabras
Sector: [ej: "ferretería", "clínica dental", "estudio de diseño", "importadora"]
```

---

## Prompts de soporte y ayuda

### Crear respuestas a preguntas de soporte

```
[CONTEXTO PYMEHUB ARRIBA]

Un cliente pregunta por soporte: "[PREGUNTA DEL CLIENTE]"

Escribe una respuesta de soporte que:
- Sea amable y empática
- Responda directamente la pregunta
- Incluya pasos específicos si aplica
- Ofrezca seguimiento si necesita más ayuda
- Máximo 150 palabras
- Firma: "Equipo de soporte PymeHub"

Pregunta: [pega la pregunta aquí]
```

### Generar notas de versión (release notes)

```
[CONTEXTO PYMEHUB ARRIBA]

Escribe las notas de versión para el release [VERSIÓN] de PymeHub.

Los cambios incluidos son:
[LISTA LOS CAMBIOS TÉCNICOS AQUÍ]

Formato:
- Encabezado con versión y fecha
- Secciones: Nuevas funcionalidades, Mejoras, Correcciones de errores
- Tono: accesible para usuarios no técnicos
- Cada item: máximo 2 oraciones
- Sin jerga de programación
```

---

## Prompts de análisis

### Analizar feedback de clientes

```
[CONTEXTO PYMEHUB ARRIBA]

Analiza los siguientes comentarios de clientes de PymeHub y genera:
1. Resumen de los 3 temas más frecuentes
2. Sentimiento general (positivo/negativo/neutro y por qué)
3. Top 3 funcionalidades más mencionadas
4. Top 3 fricciones o problemas mencionados
5. 2 recomendaciones concretas de mejora de producto basadas en el feedback

Comentarios de clientes:
[PEGA AQUÍ LOS COMENTARIOS]
```

### Generar métricas de ejemplo para demos

```
[CONTEXTO PYMEHUB ARRIBA]

Genera datos de ejemplo realistas para una demo de PymeHub para una 
[TIPO DE EMPRESA] con [N] empleados en Costa Rica.

Incluye:
- 5 contactos ficticios con nombres ticos y datos reales de CR
- 3 conversaciones activas (una de Email, una de WhatsApp, una urgente)
- 4 tareas en diferentes estados
- 2 facturas (una pagada, una vencida)
- 3 insights del mes (uno crítico, uno medio, uno bajo)
- 1 resumen diario generado por IA

Todo debe verse como datos reales de operación, no como "Empresa Ejemplo S.A."
Empresa: [ej: "ferretería familiar", "clínica veterinaria", "agencia de viajes"]
```

---

## Tips para mejores resultados

1. **Siempre incluye el contexto base** al inicio de cada prompt
2. **Sé específico** sobre el módulo, audiencia y formato deseado
3. **Pide iteraciones**: "Ahora hazlo más formal / más corto / en formato tabla"
4. **Revisa la coherencia**: Algunos datos generados por IA pueden no ser precisos — siempre verifica números y funcionalidades
5. **Reutiliza y adapta**: Modifica los ejemplos generados con el nombre real de tu empresa y datos reales antes de publicar
