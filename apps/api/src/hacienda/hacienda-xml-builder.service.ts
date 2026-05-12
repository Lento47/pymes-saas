import { BadRequestException, Injectable } from '@nestjs/common';

// Root element names per Hacienda CR document type
const DOCUMENT_ROOT_ELEMENTS: Record<string, string> = {
  FACTURA_ELECTRONICA:  'FacturaElectronica',
  TIQUETE_ELECTRONICO:  'TiqueteElectronico',
  NOTA_CREDITO:         'NotaCreditoElectronica',
  NOTA_DEBITO:          'NotaDebitoElectronica',
  MENSAJE_RECEPTOR:     'MensajeReceptor',
};

@Injectable()
export class HaciendaXmlBuilderService {
  buildInvoiceXml(payload: {
    invoice: any;
    workspaceTaxProfile: any;
    contact: any;
    lines: any[];
    referenceInvoice?: any;
  }): string {
    const { invoice, workspaceTaxProfile, contact, lines, referenceInvoice } = payload;

    const rootElement = DOCUMENT_ROOT_ELEMENTS[invoice.document_type];
    if (!rootElement) {
      throw new BadRequestException(
        `Tipo de documento fiscal no soportado para XML: ${invoice.document_type}`,
      );
    }

    const issueDate = this.formatDate(invoice.issue_date ?? invoice.created_at ?? new Date());

    const linesXml = lines.map((line) => this.buildLineaDetalle(line)).join('\n');
    const resumen = this.computeResumen(lines, invoice);
    const ubicacionXml = this.buildUbicacionXml(workspaceTaxProfile);
    const referenciaXml = referenceInvoice
      ? this.buildReferenciaXml(referenceInvoice, invoice)
      : '';

    return `<?xml version="1.0" encoding="utf-8"?>
<${rootElement}>
  <Clave>${invoice.clave ?? ''}</Clave>
  <NumeroConsecutivo>${invoice.consecutivo ?? ''}</NumeroConsecutivo>
  <FechaEmision>${issueDate}</FechaEmision>
  <Emisor>
    <Nombre>${this.esc(workspaceTaxProfile.legal_name ?? workspaceTaxProfile.trade_name ?? 'Emisor')}</Nombre>
    <Identificacion>
      <Tipo>${workspaceTaxProfile.identification_type ?? ''}</Tipo>
      <Numero>${workspaceTaxProfile.identification_number ?? ''}</Numero>
    </Identificacion>
    <NombreComercial>${this.esc(workspaceTaxProfile.trade_name ?? '')}</NombreComercial>${ubicacionXml}
    <CorreoElectronico>${workspaceTaxProfile.tax_email ?? ''}</CorreoElectronico>
  </Emisor>
  <Receptor>
    <Nombre>${this.esc(contact.company_name ?? contact.full_name ?? 'Cliente')}</Nombre>
    <Identificacion>
      <Tipo>${contact.identification_type ?? ''}</Tipo>
      <Numero>${contact.identification_number ?? ''}</Numero>
    </Identificacion>
    <CorreoElectronico>${contact.tax_email ?? contact.email ?? ''}</CorreoElectronico>
  </Receptor>
  <CondicionVenta>${invoice.sale_condition ?? '01'}</CondicionVenta>
  <MedioPago>${invoice.payment_method ?? '01'}</MedioPago>
  <DetalleServicio>
    ${linesXml}
  </DetalleServicio>${referenciaXml}
  <ResumenFactura>
    <CodigoTipoMoneda>
      <CodigoMoneda>${invoice.currency ?? 'CRC'}</CodigoMoneda>
      <TipoCambio>${Number(invoice.exchange_rate ?? 1).toFixed(5)}</TipoCambio>
    </CodigoTipoMoneda>
    <TotalServGravados>${resumen.totalServGravados.toFixed(2)}</TotalServGravados>
    <TotalServExentos>${resumen.totalServExentos.toFixed(2)}</TotalServExentos>
    <TotalMercGravados>${resumen.totalMercGravados.toFixed(2)}</TotalMercGravados>
    <TotalMercExentos>${resumen.totalMercExentos.toFixed(2)}</TotalMercExentos>
    <TotalGravado>${resumen.totalGravado.toFixed(2)}</TotalGravado>
    <TotalExento>${resumen.totalExento.toFixed(2)}</TotalExento>
    <TotalVenta>${resumen.totalVenta.toFixed(2)}</TotalVenta>
    <TotalDescuentos>${resumen.totalDescuentos.toFixed(5)}</TotalDescuentos>
    <TotalVentaNeta>${resumen.totalVentaNeta.toFixed(2)}</TotalVentaNeta>
    <TotalImpuesto>${resumen.totalImpuesto.toFixed(5)}</TotalImpuesto>
    <TotalComprobante>${resumen.totalComprobante.toFixed(2)}</TotalComprobante>
  </ResumenFactura>
</${rootElement}>`;
  }

  // ── Private builders ──────────────────────────────────────────────────────

  private buildLineaDetalle(line: any): string {
    const exoneracionXml = line.exoneration_json
      ? this.buildExonerationXml(line.exoneration_json)
      : '';
    return `
    <LineaDetalle>
      <NumeroLinea>${line.line_number}</NumeroLinea>
      <CodigoCabys>${line.cabys_code ?? ''}</CodigoCabys>
      <Cantidad>${Number(line.quantity).toFixed(3)}</Cantidad>
      <UnidadMedida>${line.unit_of_measure ?? 'Unid'}</UnidadMedida>
      <Detalle>${this.esc(line.description)}</Detalle>
      <PrecioUnitario>${Number(line.unit_price).toFixed(5)}</PrecioUnitario>
      <MontoDescuento>${Number(line.discount_amount ?? 0).toFixed(5)}</MontoDescuento>
      <SubTotal>${Number(line.subtotal ?? 0).toFixed(5)}</SubTotal>
      <Impuesto>
        <Codigo>${line.tax_code ?? '01'}</Codigo>
        <Tarifa>${Number(line.tax_rate ?? 0).toFixed(2)}</Tarifa>
        <Monto>${Number(line.tax_amount ?? 0).toFixed(5)}</Monto>
      </Impuesto>${exoneracionXml}
      <MontoTotalLinea>${Number(line.total_line_amount ?? 0).toFixed(5)}</MontoTotalLinea>
    </LineaDetalle>`;
  }

  /**
   * Computes all ResumenFactura totals from the lines array.
   * Hacienda XSD requires these fields; computing them here avoids
   * relying on possibly-stale invoice.amount.
   *
   * NOTE: The classification of a line as "mercancía" vs "servicio"
   * requires the CABYS code or a dedicated line flag. Until that flag
   * exists on InvoiceLine, we treat all lines as mercancía (most common).
   * TODO: Add `line_category` field to InvoiceLine and classify properly.
   */
  private computeResumen(lines: any[], invoice: any) {
    let totalMercGravados = 0;
    let totalMercExentos = 0;
    let totalServGravados = 0;
    let totalServExentos = 0;
    let totalDescuentos = 0;
    let totalImpuesto = 0;

    for (const line of lines) {
      const subtotal = Number(line.subtotal ?? 0);
      const taxRate = Number(line.tax_rate ?? 0);
      const discount = Number(line.discount_amount ?? 0);
      const tax = Number(line.tax_amount ?? 0);
      const isService = (line.unit_of_measure ?? '').toLowerCase() === 'sp';

      totalDescuentos += discount;
      totalImpuesto += tax;

      if (taxRate > 0) {
        isService
          ? (totalServGravados += subtotal)
          : (totalMercGravados += subtotal);
      } else {
        isService
          ? (totalServExentos += subtotal)
          : (totalMercExentos += subtotal);
      }
    }

    const totalGravado = totalMercGravados + totalServGravados;
    const totalExento = totalMercExentos + totalServExentos;
    const totalVenta = totalGravado + totalExento;
    const totalVentaNeta = totalVenta - totalDescuentos;
    const totalComprobante = totalVentaNeta + totalImpuesto;

    return {
      totalServGravados,
      totalServExentos,
      totalMercGravados,
      totalMercExentos,
      totalGravado,
      totalExento,
      totalVenta,
      totalDescuentos,
      totalVentaNeta,
      totalImpuesto,
      totalComprobante,
    };
  }

  private buildUbicacionXml(profile: any): string {
    if (!profile?.province && !profile?.canton && !profile?.district) return '';
    return `
    <Ubicacion>
      <Provincia>${profile.province ?? ''}</Provincia>
      <Canton>${profile.canton ?? ''}</Canton>
      <Distrito>${profile.district ?? ''}</Distrito>
      <OtrasSenas>${this.esc(profile.address_detail ?? '')}</OtrasSenas>
    </Ubicacion>`;
  }

  private buildReferenciaXml(refInvoice: any, currentInvoice: any): string {
    const razon =
      currentInvoice.document_type === 'NOTA_CREDITO'
        ? (currentInvoice.description ?? 'Anulación de factura electrónica')
        : (currentInvoice.description ?? 'Ajuste de débito');
    return `
  <InformacionReferencia>
    <TipoDoc>01</TipoDoc>
    <Numero>${refInvoice.clave ?? refInvoice.number ?? ''}</Numero>
    <FechaEmision>${this.formatDate(refInvoice.issue_date ?? refInvoice.created_at ?? new Date())}</FechaEmision>
    <Codigo>01</Codigo>
    <Razon>${this.esc(razon)}</Razon>
  </InformacionReferencia>`;
  }

  private buildExonerationXml(exon: any): string {
    const tipo = exon.tipo_documento ?? exon.tipoDocumento ?? '';
    const numero = exon.numero_documento ?? exon.numeroDocumento ?? '';
    const nombre = exon.nombre_institucion ?? exon.nombreInstitucion ?? '';
    const porcentaje = exon.porcentaje_exoneracion ?? exon.porcentajeExoneracion ?? 0;
    const monto = exon.monto_exoneracion ?? exon.montoExoneracion ?? 0;
    return `
      <Exoneracion>
        <TipoDocumento>${tipo}</TipoDocumento>
        <NumeroDocumento>${numero}</NumeroDocumento>
        <NombreInstitucion>${nombre}</NombreInstitucion>
        <FechaEmision>${this.formatDate(exon.fecha_emision ?? exon.fechaEmision ?? new Date())}</FechaEmision>
        <PorcentajeExoneracion>${Number(porcentaje).toFixed(2)}</PorcentajeExoneracion>
        <MontoExoneracion>${Number(monto).toFixed(5)}</MontoExoneracion>
      </Exoneracion>`;
  }

  private esc(value: string): string {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.toISOString().replace('.000Z', '')}-0600`;
  }
}
