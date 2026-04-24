# Documentos y OCR

PymeHub te permite subir y organizar documentos directamente en la plataforma, con **OCR automático** que extrae el texto de cada archivo para hacerlo buscable.

## ¿Para qué sirve?

- Centralizar contratos, cotizaciones, facturas y cualquier documento de negocio
- Extraer texto automáticamente con OCR (sin digitación manual)
- Vincular documentos a contactos, conversaciones o tareas
- Buscar dentro del contenido de los documentos
- Controlar el almacenamiento según tu plan

## Formatos soportados

| Tipo | Extensiones |
|---|---|
| Documentos | PDF, DOCX, DOC, TXT |
| Imágenes | JPG, JPEG, PNG, WEBP |
| Hojas de cálculo | XLSX, CSV |
| Máximo por archivo | **25 MB** |

## Subir un documento

### Desde la sección Documentos

1. Ve a **Documentos** → **"Subir documento"**
2. Selecciona el archivo desde tu computadora (arrastrar y soltar también funciona)
3. Opcionalmente, vincula a:
   - Un **contacto** (ej: contrato del cliente Juan Pérez)
   - Una **conversación** (ej: adjunto enviado en ese hilo)
   - Una **tarea** (ej: documento de referencia para completar la tarea)
4. Haz clic en **"Subir"**

### Desde una conversación

Al responder un mensaje, puedes adjuntar documentos directamente. Estos quedan vinculados automáticamente a la conversación.

### Desde el perfil de un contacto

En la sección **"Documentos"** del perfil, sube archivos que quedan asociados directamente al contacto.

## Ciclo de vida del documento

```
SUBIDO → PROCESANDO (OCR) → PROCESADO
                          ↘ FALLIDO
```

| Estado | Descripción |
|---|---|
| **Subido** | Archivo recibido y guardado en almacenamiento |
| **Procesando** | OCR en ejecución (proceso asíncrono) |
| **Procesado** | OCR completado, texto disponible para búsqueda |
| **Fallido** | Error al procesar (archivo corrupto, formato no soportado) |

El OCR se ejecuta automáticamente en segundo plano. Dependiendo del tamaño del archivo, puede tomar algunos segundos o minutos.

## OCR — Reconocimiento de texto

El **OCR (Optical Character Recognition)** extrae automáticamente el texto de imágenes y PDFs escaneados. Esto permite:

- **Buscar por contenido**: Encuentra documentos por cualquier palabra del texto
- **Indexación automática**: Sin trabajo manual de digitación
- **Vinculación inteligente**: PymeHub puede sugerir tareas basándose en el contenido extraído

::: tip ¿Cuándo es útil el OCR?
- Facturas de proveedores escaneadas
- Contratos firmados en papel y fotografiados
- Imágenes de comprobantes de pago
- Documentos de identidad digitalizados
:::

## Buscar documentos

Desde la sección **Documentos**, usa la barra de búsqueda para encontrar archivos por:

- **Nombre del archivo**
- **Texto extraído por OCR** (si el documento fue procesado)
- **Nombre del contacto** vinculado

## Almacenamiento y límites

El almacenamiento disponible depende de tu plan:

| Plan | Almacenamiento |
|---|---|
| Free | 100 MB |
| Starter | 5 GB |
| Growth | 50 GB |
| Enterprise | Ilimitado |

Puedes ver el uso actual en **Configuración → Workspace → Almacenamiento**.

Cuando te acercas al límite, PymeHub te notifica con anticipación. Si lo superas, no podrás subir nuevos documentos hasta que liberes espacio o cambies de plan.

## Eliminar documentos

Para eliminar un documento:
1. Abre el documento
2. Haz clic en el menú de opciones (⋮)
3. Selecciona **"Eliminar"**

::: warning
La eliminación es permanente. El archivo se borra del almacenamiento y no se puede recuperar.
:::

## Seguridad de los documentos

- Todos los archivos se almacenan en S3/MinIO con acceso privado
- Solo los miembros del workspace pueden acceder a los documentos
- Las URLs de descarga son temporales y firmadas (expiran automáticamente)
- Los secretos de configuración del almacenamiento están encriptados
