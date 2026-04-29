# Politica de Clasificacion de Datos de PymeHub

## 1. Proposito

Esta politica clasifica la informacion tratada por PymeHub para aplicar controles proporcionales al riesgo y evitar tratamientos indiferenciados entre informacion publica, operativa, sensible o secreta.

## 2. Niveles de clasificacion

### Publica

Informacion destinada a publicacion abierta, como paginas legales, marketing o contenido comercial aprobado.

### Interna

Informacion de uso interno que no debe publicarse sin autorizacion, como procesos, backlog, reportes de trabajo y documentacion operacional general.

### Confidencial

Informacion comercial, contractual o tecnica sensible, incluyendo propuestas, pricing interno, incidentes, configuraciones de cliente y tickets.

### Sensible de cliente

Conversaciones, documentos, OCR, datos de contacto, tareas, historiales y cualquier contenido cargado o generado en el contexto del workspace del cliente.

### Credenciales y secretos

Contraseñas, llaves API, tokens, certificados, secretos de infraestructura y otros materiales de autenticacion o cifrado.

## 3. Reglas de aplicacion

- Todo dato debe recibir una clasificacion razonable al momento de su diseño o uso principal.
- Si existe duda entre dos niveles, debe usarse el mas restrictivo.
- Los secretos nunca deben tratarse como datos internos comunes.
- Los datos del cliente deben presumirse, al menos, `Confidencial` y generalmente `Sensible de cliente`.

## 4. Aplicacion practica en PymeHub

- prompts y outputs de IA: `Confidencial` o `Sensible de cliente` segun contenido.
- logs: `Interna`, `Confidencial` o `Sensible de cliente` segun el payload y los identificadores presentes.
- documentos del cliente: `Sensible de cliente`.
- configuraciones de integraciones: `Confidencial` o `Credenciales y secretos`.
- matrices de riesgos y vendor review: `Interna` o `Confidencial`.

## 5. Evidencia y mantenimiento

Esta politica debe reflejarse en decisiones de:

- acceso;
- logging;
- exportacion;
- retencion;
- soporte;
- redaccion de prompts y procesamiento OCR.
