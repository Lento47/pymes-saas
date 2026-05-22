# Politica de Retencion y Eliminacion de Datos de PymesHub

## 1. Proposito

Esta politica define como PymesHub conserva, restringe, anonimiza o elimina las principales categorias de datos del servicio. Su objetivo es evitar retencion indefinida no justificada y sostener una regla coherente para servicio activo, cancelacion, privacidad, seguridad y backups.

## 2. Alcance

Aplica a:

- cuentas y usuarios;
- contactos, conversaciones y mensajes;
- tareas y eventos operativos;
- documentos y OCR;
- logs y auditorias;
- prompts, outputs y resúmenes IA;
- backups y copias residuales.

## 3. Principios

- retener solo lo necesario;
- diferenciar datos activos de evidencia minima de cumplimiento;
- permitir borrado o anonimización cuando proceda;
- reconocer que los backups pueden seguir otro ciclo tecnico;
- tratar el texto OCR y ciertos outputs IA como datos potencialmente sensibles.

## 4. Criterios por categoria

### 4.1 Usuarios y cuentas

Se retienen mientras la cuenta o workspace esten activos y por un periodo posterior razonable para seguridad, auditoria, facturacion o defensa legal.

### 4.2 Contactos, conversaciones y mensajes

Se retienen mientras el cliente mantenga el servicio y durante el periodo de gracia posterior a la terminacion, salvo solicitud valida, restriccion legal o politica especifica del cliente implementada en producto.

### 4.3 Tareas, notificaciones y eventos operativos

Se retienen como parte del historial operacional del workspace, salvo que una politica especifica de producto defina depuracion por edad o categoria.

### 4.4 Documentos y OCR

Los documentos se retienen mientras sigan vinculados al servicio activo del cliente y no exista una instruccion valida de eliminacion. El texto OCR se trata con el mismo o mayor nivel de cuidado que el documento original.

### 4.5 Audit logs

Los logs de auditoria deben retenerse por un plazo suficiente para seguridad, soporte, investigaciones y reconstruccion de hechos, incluso cuando ciertos datos operativos ya no permanezcan activos.

### 4.6 IA, prompts y outputs

Prompts, outputs y resúmenes IA deben retenerse solo mientras sirvan a la funcionalidad, trazabilidad, soporte o seguridad. Debe evitarse su almacenamiento indefinido si no existe necesidad justificada.

### 4.7 Backups

Los backups siguen ventanas tecnicas propias de continuidad. Su contenido puede subsistir temporalmente tras la baja de datos activos, pero debe expirar o sobrescribirse conforme al ciclo definido.

## 5. Eventos que activan borrado o restriccion

El borrado, supresion logica o anonimización puede activarse por:

- cancelacion del servicio;
- solicitud valida de privacidad;
- expiracion del plazo de retencion;
- correccion de carga indebida;
- mitigacion de incidente;
- decision operativa aprobada conforme a esta politica.

## 6. Modalidades de eliminacion

Segun la viabilidad tecnica, se puede aplicar:

- borrado fisico;
- supresion logica;
- anonimización;
- depuracion programada posterior.

## 7. Evidencia y registros

Cuando se ejecuten procesos relevantes de eliminacion o restriccion, debe quedar evidencia minima sobre:

- categoria afectada;
- motivo;
- fecha;
- responsable o sistema que ejecuto la accion;
- limitaciones tecnicas si no se completo borrado fisico inmediato.
