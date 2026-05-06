export interface InvoiceTemplate {
  industry: string;
  name: string;
  document_type: string;
  activity_code: string;
  sale_condition: string;
  payment_method: string;
  tax_rate: string;
  currency: string;
  sample_line_description: string;
  common_cabys: string[];
  notes: string;
}

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    industry: "servicios_profesionales",
    name: "Factura de servicios profesionales",
    document_type: "FACTURA_ELECTRONICA",
    activity_code: "620100",
    sale_condition: "02",
    payment_method: "03",
    tax_rate: "13",
    currency: "CRC",
    sample_line_description: "Honorarios profesionales por servicios prestados",
    common_cabys: ["6201000000100"],
    notes: "Plantilla para servicios profesionales (abogados, contadores, ingenieros, etc.). Actividad: Actividades jurídicas.",
  },
  {
    industry: "comercio_minorista",
    name: "Factura de venta retail",
    document_type: "FACTURA_ELECTRONICA",
    activity_code: "471100",
    sale_condition: "01",
    payment_method: "01",
    tax_rate: "13",
    currency: "CRC",
    sample_line_description: "Venta de mercadería según detalle",
    common_cabys: ["4711000000100"],
    notes: "Plantilla para comercio minorista (tiendas, supermercados, misceláneas). Actividad: Venta al por menor en comercios no especializados.",
  },
  {
    industry: "construccion",
    name: "Factura de obra o servicios de construcción",
    document_type: "FACTURA_ELECTRONICA",
    activity_code: "410002",
    sale_condition: "02",
    payment_method: "03",
    tax_rate: "13",
    currency: "CRC",
    sample_line_description: "Servicios de construcción según contrato",
    common_cabys: ["4100020000100"],
    notes: "Plantilla para empresas de construcción, ingeniería civil e inmobiliarias. Actividad: Construcción de edificios.",
  },
  {
    industry: "consultoria",
    name: "Factura de consultoría",
    document_type: "FACTURA_ELECTRONICA",
    activity_code: "702000",
    sale_condition: "02",
    payment_method: "03",
    tax_rate: "13",
    currency: "CRC",
    sample_line_description: "Servicios de consultoría empresarial",
    common_cabys: ["7020000000100"],
    notes: "Plantilla para consultoría empresarial, TI, marketing y afines. Actividad: Actividades de consultoría de gestión.",
  },
  {
    industry: "restaurante",
    name: "Tiquete electrónico de restaurante",
    document_type: "TIQUETE_ELECTRONICO",
    activity_code: "561001",
    sale_condition: "01",
    payment_method: "01",
    tax_rate: "13",
    currency: "CRC",
    sample_line_description: "Consumo de alimentos y bebidas",
    common_cabys: ["5610010000100"],
    notes: "Plantilla para restaurantes, sodas y servicios de comida. Actividad: Actividades de restaurantes y servicio de comidas.",
  },
  {
    industry: "alquiler",
    name: "Factura de alquiler de inmueble",
    document_type: "FACTURA_ELECTRONICA",
    activity_code: "681000",
    sale_condition: "02",
    payment_method: "03",
    tax_rate: "13",
    currency: "CRC",
    sample_line_description: "Alquiler mensual de inmueble",
    common_cabys: ["6810000000100"],
    notes: "Plantilla para arrendamiento de bienes inmuebles. Actividad: Actividades inmobiliarias realizadas con bienes propios o arrendados.",
  },
];

export function getTemplatesByIndustry(industry?: string): InvoiceTemplate[] {
  if (!industry) return INVOICE_TEMPLATES;
  return INVOICE_TEMPLATES.filter(t => t.industry === industry);
}
