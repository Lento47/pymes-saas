# Uso de IA y Disclosure en PymesHub

## 1. Proposito

Esta especificacion define como PymesHub debe usar IA, que debe comunicar al cliente y que controles minimos debe sostener para reducir uso excesivo de datos o interpretaciones incorrectas sobre los resultados.

## 2. Alcance

Aplica a resúmenes diarios, insights, clasificacion, asistencia operativa y cualquier otra capacidad del producto que envíe contexto a modelos externos o internos de IA.

## 3. Reglas de uso

- Enviar a modelos solo el contexto razonablemente necesario.
- Evitar prompts con datos excesivos cuando un resumen o extracto sea suficiente.
- No presentar outputs como verdad absoluta.
- Exigir revision humana en decisiones sensibles, comerciales, legales o de alto impacto.
- Permitir desactivar o limitar funciones IA para ciertos clientes si el producto o modelo comercial lo contempla.

## 4. Disclosure al cliente

La documentacion y la UI deben indicar:

- que funciones usan IA;
- que tipos de datos pueden procesarse;
- que terceros intervienen;
- que las respuestas pueden contener errores u omisiones;
- que el cliente sigue siendo responsable por decisiones finales.

## 5. Controles tecnicos recomendados

- configuracion por workspace para habilitar o limitar IA;
- minimizacion previa al envio;
- trazabilidad de llamadas relevantes;
- politica de retencion de prompts y outputs alineada con privacidad y seguridad.

## 6. Evidencia esperada

Debe poder demostrarse:

- que el cliente fue informado del uso de IA;
- que existe una regla de minimizacion;
- que el producto distingue entre outputs automatizados y decisiones finales del cliente.
