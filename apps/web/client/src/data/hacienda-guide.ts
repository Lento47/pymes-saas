export const HACIENDA_GUIDE = [
  {
    title: "Modo",
    meaning: "Define si la factura será solo comercial o si también debe convertirse en comprobante electrónico oficial ante Hacienda.",
    example: "`MANUAL_ONLY`: cobro interno sin envío oficial. `HACIENDA`: genera XML, firma, envío y seguimiento.",
  },
  {
    title: "Documento",
    meaning: "Es el tipo de comprobante fiscal que vas a emitir.",
    example: "`FACTURA_ELECTRONICA` para ventas normales, `TIQUETE_ELECTRONICO` para venta simplificada, `NOTA_CREDITO` para rebajos o anulaciones parciales.",
  },
  {
    title: "Condición de venta",
    meaning: "Describe cómo se pactó el pago de la operación.",
    example: "`01` contado, `02` crédito. Si la venta se paga después, normalmente corresponde crédito.",
  },
  {
    title: "Medio de pago",
    meaning: "Indica cómo el cliente pagó o pagará la operación.",
    example: "`01` efectivo, `02` tarjeta, `03` transferencia, según el catálogo tributario aplicable.",
  },
  {
    title: "Actividad",
    meaning: "Código de actividad económica del emisor que respalda esa venta.",
    example: "Si la empresa tiene varias actividades registradas, aquí se indica cuál aplica para esta factura.",
  },
  {
    title: "CABYS",
    meaning: "Código del catálogo CABYS para el producto o servicio facturado. Hacienda lo usa para clasificar lo vendido.",
    example: "Un servicio profesional y un producto físico usan códigos distintos; no conviene inventarlo, hay que buscar el correcto.",
  },
  {
    title: "Impuesto %",
    meaning: "Porcentaje del impuesto aplicado a la línea.",
    example: "`13` para IVA general, `0` si el concepto no lleva impuesto o está exento según corresponda.",
  },
  {
    title: "Clave y consecutivo",
    meaning: "Identificadores oficiales del comprobante. El sistema los genera y luego se usan para consultar estado, notas y mensajes del receptor.",
    example: "Después del envío a Hacienda, la clave identifica de forma única el comprobante aceptado o rechazado.",
  },
];
