# Facturación

PymeHub incluye un módulo completo de facturación que te permite crear facturas, enviar recordatorios de cobro automáticos y — para empresas en Costa Rica — integrar directamente con **Hacienda** para facturación electrónica.

## Modos de facturación

PymeHub soporta dos modos:

| Modo | Descripción |
|---|---|
| **Manual** | Creas y gestionas facturas dentro de PymeHub. Puedes exportar el PDF y enviarlo como quieras. |
| **Hacienda** | Facturación electrónica oficial integrada con el Ministerio de Hacienda de Costa Rica. |

## Crear una factura

Ve a **Facturación** → **"Nueva factura"**:

### 1. Información general
- **Cliente** — Selecciona del CRM o crea uno nuevo
- **Número de factura** — Automático o personalizado
- **Fecha de emisión**
- **Fecha de vencimiento** — Cuándo se espera el pago

### 2. Líneas de factura

Agrega las líneas de productos o servicios:

| Campo | Descripción |
|---|---|
| Descripción | Nombre del producto o servicio |
| Cantidad | Unidades |
| Precio unitario | Valor por unidad |
| Impuesto | IVA, Exonerado, etc. |
| Subtotal | Calculado automáticamente |

PymeHub calcula automáticamente subtotales, impuestos y el total de la factura.

### 3. Notas y condiciones

Campo libre para agregar términos de pago, instrucciones de transferencia u observaciones para el cliente.

## Estados de factura

```
BORRADOR → ENVIADA → PARCIALMENTE PAGADA → PAGADA
                                         ↘ VENCIDA
        ↘ CANCELADA
```

| Estado | Descripción |
|---|---|
| **Borrador** | En preparación, no enviada al cliente |
| **Enviada** | Factura entregada al cliente |
| **Parcialmente pagada** | Pago parcial recibido |
| **Pagada** | Pago completo recibido |
| **Vencida** | Superó la fecha límite sin pago |
| **Cancelada** | Anulada (no genera movimiento contable) |

## Recordatorios de cobro automáticos

PymeHub puede enviar recordatorios automáticos a tus clientes para facturas próximas a vencer o ya vencidas.

### Configurar un recordatorio

Desde la factura, haz clic en **"Programar recordatorio"**:

1. Selecciona el **canal**: Email o WhatsApp
2. Define **cuándo enviarlo**: X días antes del vencimiento, o en la fecha exacta
3. El sistema genera automáticamente el texto del recordatorio (con IA)
4. Puedes editarlo antes de confirmar

### Recordatorio manual

Si una factura ya está vencida, puedes enviar un recordatorio inmediato con **"Enviar recordatorio ahora"**. El sistema generará un mensaje apropiado y lo enviará al email o WhatsApp del cliente.

## Facturas vencidas

Ve a **Facturación → "Vencidas"** para ver todas las facturas que superaron su fecha de pago. Desde aquí puedes:

- Enviar recordatorio masivo
- Actualizar el estado manualmente
- Ver el historial de recordatorios enviados

## Facturación electrónica (Costa Rica)

Para empresas costarricenses, PymeHub se integra con el sistema de facturación electrónica de **Ministerio de Hacienda**.

### Requisitos previos

1. Certificado digital de firma electrónica (Hacienda CR)
2. Cédula jurídica o cédula física registrada como contribuyente
3. Pin de la plataforma de Hacienda

### Configurar la integración

Ve a **Configuración → Hacienda** y completa:
- Cédula del contribuyente
- Nombre de la empresa (tal como aparece en el registro)
- Certificado de firma electrónica
- Entorno: **Pruebas** o **Producción**

### Emitir una factura electrónica

1. Crea la factura normalmente
2. En el campo **"Modo"**, selecciona **"Hacienda"**
3. Completa el número de cédula del receptor
4. Selecciona el **tipo de documento**:
   - Factura electrónica
   - Tiquete electrónico
   - Nota de crédito
5. Asigna el **código CABYS** a cada línea (usa el buscador integrado)
6. Haz clic en **"Emitir a Hacienda"**

PymeHub enviará el documento XML a Hacienda y recibirás la respuesta en segundos:
- **Aceptado**: La factura es válida y oficial
- **Rechazado**: Error en los datos (PymeHub muestra el motivo)

### Consultar estado en Hacienda

Desde la factura emitida, puedes consultar el estado actual directamente en el sistema de Hacienda con **"Consultar estado"**.

### Tasa de cambio

Si facturas en USD o EUR, PymeHub obtiene automáticamente la tasa de cambio oficial diaria del Banco Central de Costa Rica.

::: info Más sobre Hacienda
Ver [Integraciones → Hacienda Costa Rica](/integraciones/hacienda) para guía completa.
:::

## Impuestos

PymeHub soporta diferentes tipos de impuesto:

| Código | Descripción |
|---|---|
| IVA 13% | Impuesto al Valor Agregado estándar (CR) |
| IVA 4% | IVA reducido (servicios médicos privados) |
| IVA 2% | IVA reducido (canasta básica) |
| IVA 1% | IVA reducido (medicamentos y materias primas) |
| EXO | Exonerado |
| EXE | Exento |

## Permisos requeridos

Para gestionar facturas se necesita el permiso `can_manage_invoices`. Por defecto lo tienen Owners y Admins; se puede otorgar individualmente a Agents.
