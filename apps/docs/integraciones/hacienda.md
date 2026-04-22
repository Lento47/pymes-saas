# Integración con Hacienda (Costa Rica)

PymeHub se integra directamente con el **Ministerio de Hacienda de Costa Rica** para emisión de comprobantes electrónicos, validación de contribuyentes y consulta de tasas de cambio.

## ¿Qué incluye la integración?

| Funcionalidad | Descripción |
|---|---|
| **Facturación electrónica** | Emite facturas, tiquetes y notas de crédito directamente a Hacienda |
| **Validación de contribuyente** | Verifica cédulas jurídicas y físicas en el registro de Hacienda |
| **Búsqueda CABYS** | Encuentra el código de actividad económica correcto para cada línea |
| **Consulta de exoneraciones** | Verifica si aplica exoneración fiscal a un cliente |
| **Tasa de cambio** | Obtiene la tasa oficial diaria del Banco Central |

## Tipos de comprobante soportados

| Tipo | Código | Descripción |
|---|---|---|
| Factura Electrónica | FE | Para ventas a contribuyentes inscritos |
| Tiquete Electrónico | TE | Para ventas al consumidor final |
| Nota de Crédito | NC | Para anulaciones o ajustes |

## Configuración inicial

### Paso 1: Verificar tu registro en Hacienda

Antes de configurar la integración, asegúrate de tener:

- Cédula jurídica o física activa
- Resolución de autorización de facturación electrónica
- Certificado de firma digital (Persona Física o Jurídica)
- PIN de acceso a ATV (Administración Tributaria Virtual)

Si no has sido autorizado para facturación electrónica, solicítalo en [atv.hacienda.go.cr](https://atv.hacienda.go.cr).

### Paso 2: Configurar en PymeHub

Ve a **Configuración → Hacienda** y completa:

```
Tipo de identificación: Cédula Física / Cédula Jurídica / DIMEX / NITE
Número de identificación: [tu cédula o RUC]
Nombre del emisor: [tal como aparece en Hacienda]
Correo de emisor: [email registrado en Hacienda]
Certificado (p12): [sube tu archivo de firma digital]
Pin del certificado: [pin de tu firma digital]
Entorno: Pruebas / Producción
```

::: warning Entorno de pruebas
Siempre prueba la integración en el entorno de **pruebas** (sandbox de Hacienda) antes de activar en producción. Los comprobantes emitidos en pruebas no tienen validez fiscal.
:::

### Paso 3: Validar la configuración

Haz clic en **"Validar configuración"**. PymeHub intentará autenticarse con Hacienda y te indicará si todo está correcto.

## Emitir una factura electrónica

1. Crea una nueva factura (ver [Facturación](/features/invoices))
2. En el campo **"Modo de emisión"**, selecciona **"Hacienda"**
3. Completa los datos del receptor:
   - Tipo de identificación del cliente
   - Número de identificación
   - Nombre
   - Email (para envío de comprobante)
4. En cada línea de la factura, asigna el **código CABYS**:
   - Usa el buscador integrado: escribe la descripción y selecciona el código correcto
5. Selecciona el **tipo de comprobante** (Factura, Tiquete, Nota de Crédito)
6. Revisa el total, impuestos y datos del receptor
7. Haz clic en **"Emitir a Hacienda"**

PymeHub generará el XML firmado digitalmente y lo enviará a Hacienda. Recibirás la respuesta en segundos.

## Códigos CABYS

El **Catálogo de Bienes y Servicios (CABYS)** es el sistema de Hacienda para clasificar productos y servicios. Cada línea de factura debe tener un código CABYS.

### Buscar un código CABYS

Usa el endpoint integrado en PymeHub:

```http
GET /api/hacienda/cabys?q=servicio+consultoría
```

O desde la interfaz: al editar una línea de factura, haz clic en el campo CABYS y escribe la descripción del producto o servicio.

## Validar un contribuyente

Antes de emitir una factura a un cliente, valida que su cédula sea válida:

```http
POST /api/hacienda/validate-taxpayer
Content-Type: application/json

{
  "id_type": "01",
  "id_number": "3101234567"
}
```

**Respuesta:**
```json
{
  "valid": true,
  "name": "EMPRESA EJEMPLO S.A.",
  "status": "activo"
}
```

También puedes validarlo desde la interfaz al crear una factura: el campo de cédula del cliente tiene un botón de validación en tiempo real.

## Consultar exoneraciones

Si un cliente tiene una exoneración de impuesto, puedes consultarla:

```http
GET /api/hacienda/exonerations/{authorization_number}
```

Retorna los detalles de la exoneración: tipo, vigencia, porcentaje aplicable.

## Tasa de cambio

Para facturas en moneda extranjera, PymeHub obtiene automáticamente la tasa de cambio oficial:

```http
GET /api/hacienda/exchange-rate
```

**Respuesta:**
```json
{
  "date": "2025-01-15",
  "buy": 510.25,
  "sell": 516.50,
  "currency": "USD"
}
```

La tasa se actualiza automáticamente cada día y se usa en los cálculos de facturación en USD.

## Estados de un comprobante electrónico

| Estado | Descripción |
|---|---|
| **Borrador** | Generado en PymeHub, no enviado a Hacienda |
| **Pendiente** | Enviado a Hacienda, esperando respuesta |
| **Aceptado** | Hacienda lo aceptó. El comprobante es válido fiscalmente |
| **Rechazado** | Hacienda lo rechazó. Ver motivo y corregir |

## Solución de problemas

**Error: "Certificado inválido"**
- Verifica que el archivo .p12 sea el certificado correcto
- Confirma que el pin sea correcto
- El certificado puede haber expirado — consúltalo en el BCCR

**Error: "Contribuyente no encontrado"**
- La cédula ingresada no está registrada en Hacienda
- Verifica el tipo de identificación (01 = cédula física, 02 = cédula jurídica)

**Error: "CABYS inválido"**
- El código CABYS seleccionado no corresponde al tipo de bien o servicio
- Usa el buscador de CABYS para encontrar el código correcto

**Hacienda no responde (timeout)**
- El servicio de Hacienda puede estar en mantenimiento
- Reintenta en unos minutos
- Consulta el estado en [servicios.hacienda.go.cr](https://servicios.hacienda.go.cr)
