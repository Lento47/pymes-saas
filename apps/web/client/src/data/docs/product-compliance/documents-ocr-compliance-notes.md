# Notas de Cumplimiento para Documentos y OCR en PymesHub

## 1. Proposito

Esta especificacion documenta los controles minimos de cumplimiento que PymesHub debe sostener cuando permite cargar documentos y extraer texto mediante OCR.

## 2. Alcance

Aplica a:

- documentos subidos por usuarios del workspace;
- archivos asociados a conversaciones, contactos o tareas;
- previews, metadatos y texto OCR;
- procesos de almacenamiento, consulta, exportacion y eliminacion.

## 3. Tipos de documento previstos

- facturas y comprobantes;
- ordenes de servicio;
- cotizaciones;
- contratos;
- comprobantes internos de soporte;
- documentos operativos del cliente.

## 4. Reglas obligatorias

- Informar que los documentos pueden almacenarse y procesarse mediante OCR.
- Restringir acceso por workspace y por rol.
- Tratar el texto OCR con igual o mayor sensibilidad que el archivo fuente.
- Permitir eliminacion y exportacion dentro de lo tecnicamente viable.
- Evitar exponer contenido o texto OCR en logs o errores.

## 5. Criterio de uso

El OCR debe presentarse como herramienta de apoyo. No debe comunicarse como sustituto de validacion humana en contextos fiscales, contractuales o de cobro.
