# CRM de Contactos

El **CRM de Contactos** es el directorio central de todas las personas y empresas con las que interactúas. Cada contacto tiene un historial completo de conversaciones, tareas y documentos.

## ¿Para qué sirve?

Con el CRM de PymeHub puedes:

- Mantener un registro organizado de clientes, proveedores y leads
- Ver el historial completo de comunicaciones con cada contacto
- Vincular tareas y documentos directamente al contacto
- Buscar y filtrar contactos por múltiples criterios
- Exportar la base de datos (plan Starter+)

## Tipos de contacto

| Tipo | Uso |
|---|---|
| **Cliente** | Personas u organizaciones que compran tus productos o servicios |
| **Proveedor** | Empresas o personas que te venden insumos o servicios |
| **Lead** | Prospectos en proceso de evaluación o conversión |
| **Otro** | Socios, aliados, contactos administrativos, etc. |

## Crear un contacto

Ve a **Contactos** → **"Nuevo contacto"** y completa:

### Información básica
- **Nombre completo** (requerido)
- **Empresa / Organización**
- **Email** — usado para vincular conversaciones de email
- **Teléfono** — usado para vincular conversaciones de WhatsApp
- **Tipo** de contacto (Cliente, Proveedor, Lead, Otro)

### Información adicional
- **Dirección**
- **Sitio web**
- **Notas** — descripción libre del contacto
- **Etiquetas** — para segmentar y filtrar

::: info Creación automática
Cuando recibes un email o WhatsApp de alguien nuevo, PymeHub crea el contacto automáticamente usando el email o número de teléfono como identificador.
:::

## Perfil del contacto

El perfil del contacto es una vista completa de toda la relación con esa persona:

### Información general
Todos los datos del contacto con opción de editar.

### Historial de conversaciones
Todas las conversaciones vinculadas, ordenadas por fecha. Puedes hacer clic en cualquiera para abrirla directamente.

### Tareas asociadas
Lista de tareas vinculadas al contacto. Puedes crear nuevas tareas directamente desde aquí.

### Documentos
Archivos subidos o vinculados al contacto (contratos, cotizaciones, facturas, etc.).

### Última interacción
Fecha y canal del último contacto registrado.

## Búsqueda y filtros

El listado de contactos soporta:

- **Búsqueda de texto**: por nombre, email o teléfono
- **Filtro por tipo**: Cliente, Proveedor, Lead, Otro
- **Filtro por etiquetas**
- **Ordenar por**: fecha de creación, última interacción, nombre

## Etiquetas

Las etiquetas son palabras clave libres que puedes asignar a contactos para segmentarlos:

Ejemplos:
- `premium`, `vip`, `activo`, `inactivo`
- `region-norte`, `industria-retail`
- `importar-2025`, `seguimiento-pendiente`

Luego puedes filtrar por etiqueta para ver grupos específicos.

## Eliminar contactos

::: warning Permiso requerido
Eliminar contactos requiere el permiso `can_delete_contacts`. Por defecto, solo los Admins y Owners pueden hacerlo.
:::

Eliminar un contacto es una acción irreversible que también elimina el vínculo con sus conversaciones, tareas y documentos (los registros permanecen pero sin contacto asociado).

## Exportar contactos

Con el permiso `can_export_data` (disponible desde plan Starter), puedes exportar tu base de contactos en formato CSV desde:

**Configuración → Workspace → Exportar datos**

El archivo incluye todos los campos del contacto y la fecha de última interacción.
