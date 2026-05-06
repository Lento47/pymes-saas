import { Injectable } from '@nestjs/common';

@Injectable()
export class HaciendaXmlBuilderService {
  buildInvoiceXml(payload: {
    invoice: any;
    workspaceTaxProfile: any;
    contact: any;
    lines: any[];
    referenceInvoice?: any;
  }) {
    const { invoice, workspaceTaxProfile, contact, lines, referenceInvoice } = payload;
    const issueDate = this.formatDate(invoice.issue_date ?? invoice.created_at ?? new Date());
    const escapedDescription = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const linesXml = lines
      .map((line) => {
        const subtotal = Number(line.subtotal ?? 0).toFixed(5);
        const taxAmount = Number(line.tax_amount ?? 0).toFixed(5);
        const total = Number(line.total_line_amount ?? 0).toFixed(5);
        const exonerationXml = line.exoneration_json ? this.buildExonerationXml(line.exoneration_json) : '';
        return `
          <LineaDetalle>
            <NumeroLinea>${line.line_number}</NumeroLinea>
            <CodigoCabys>${line.cabys_code ?? ''}</CodigoCabys>
            <Cantidad>${Number(line.quantity).toFixed(3)}</Cantidad>
            <UnidadMedida>${line.unit_of_measure ?? 'Unid'}</UnidadMedida>
            <Detalle>${escapedDescription(line.description)}</Detalle>
            <PrecioUnitario>${Number(line.unit_price).toFixed(5)}</PrecioUnitario>
            <MontoDescuento>${Number(line.discount_amount ?? 0).toFixed(5)}</MontoDescuento>
            <SubTotal>${subtotal}</SubTotal>
            <Impuesto>
              <Codigo>${line.tax_code ?? '01'}</Codigo>
              <Tarifa>${Number(line.tax_rate ?? 0).toFixed(2)}</Tarifa>
              <Monto>${taxAmount}</Monto>
            </Impuesto>${exonerationXml}
            <MontoTotalLinea>${total}</MontoTotalLinea>
          </LineaDetalle>`;
      })
      .join('\n');

    const ubicacionXml = this.buildUbicacionXml(workspaceTaxProfile);
    const referenciaXml = referenceInvoice ? this.buildReferenciaXml(referenceInvoice, invoice) : '';

    return `<?xml version="1.0" encoding="utf-8"?>
<FacturaElectronica>
  <Clave>${invoice.clave ?? ''}</Clave>
  <NumeroConsecutivo>${invoice.consecutivo ?? ''}</NumeroConsecutivo>
  <FechaEmision>${issueDate}</FechaEmision>
  <Emisor>
    <Nombre>${escapedDescription(workspaceTaxProfile.legal_name ?? workspaceTaxProfile.trade_name ?? 'Emisor')}</Nombre>
    <Identificacion>
      <Tipo>${workspaceTaxProfile.identification_type ?? ''}</Tipo>
      <Numero>${workspaceTaxProfile.identification_number ?? ''}</Numero>
    </Identificacion>
    <NombreComercial>${escapedDescription(workspaceTaxProfile.trade_name ?? '')}</NombreComercial>${ubicacionXml}
    <CorreoElectronico>${workspaceTaxProfile.tax_email ?? ''}</CorreoElectronico>
  </Emisor>
  <Receptor>
    <Nombre>${escapedDescription(contact.company_name ?? contact.full_name ?? 'Cliente')}</Nombre>
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
    <TotalComprobante>${Number(invoice.amount ?? 0).toFixed(2)}</TotalComprobante>
  </ResumenFactura>
</FacturaElectronica>`;
  }

  private buildUbicacionXml(profile: any): string {
    if (!profile?.province && !profile?.canton && !profile?.district) return '';
    return `
    <Ubicacion>
      <Provincia>${profile.province ?? ''}</Provincia>
      <Canton>${profile.canton ?? ''}</Canton>
      <Distrito>${profile.district ?? ''}</Distrito>
      <OtrasSenas>${this.escape(profile.address_detail ?? '')}</OtrasSenas>
    </Ubicacion>`;
  }

  private buildReferenciaXml(refInvoice: any, currentInvoice: any): string {
    const razon = currentInvoice.document_type === 'NOTA_CREDITO'
      ? (currentInvoice.description ?? 'Anulación de factura electrónica')
      : (currentInvoice.description ?? 'Ajuste de débito');
    return `
  <InformacionReferencia>
    <TipoDoc>01</TipoDoc>
    <Numero>${refInvoice.clave ?? refInvoice.number ?? ''}</Numero>
    <FechaEmision>${this.formatDate(refInvoice.issue_date ?? refInvoice.created_at ?? new Date())}</FechaEmision>
    <Codigo>01</Codigo>
    <Razon>${this.escape(razon)}</Razon>
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

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatDate(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    const offset = '-0600';
    return `${date.toISOString().replace('.000Z', '')}${offset}`;
  }
}
