import { Injectable } from '@nestjs/common';

@Injectable()
export class HaciendaXmlBuilderService {
  buildInvoiceXml(payload: {
    invoice: any;
    workspaceTaxProfile: any;
    contact: any;
    lines: any[];
  }) {
    const { invoice, workspaceTaxProfile, contact, lines } = payload;
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
            </Impuesto>
            <MontoTotalLinea>${total}</MontoTotalLinea>
          </LineaDetalle>`;
      })
      .join('\n');

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
    <NombreComercial>${escapedDescription(workspaceTaxProfile.trade_name ?? '')}</NombreComercial>
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
  </DetalleServicio>
  <ResumenFactura>
    <CodigoTipoMoneda>
      <CodigoMoneda>${invoice.currency ?? 'CRC'}</CodigoMoneda>
      <TipoCambio>${Number(invoice.exchange_rate ?? 1).toFixed(5)}</TipoCambio>
    </CodigoTipoMoneda>
    <TotalComprobante>${Number(invoice.amount ?? 0).toFixed(2)}</TotalComprobante>
  </ResumenFactura>
</FacturaElectronica>`;
  }

  private formatDate(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    const offset = '-0600';
    return `${date.toISOString().replace('.000Z', '')}${offset}`;
  }
}
