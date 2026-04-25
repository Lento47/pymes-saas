import * as PDFDocument from 'pdfkit';

export interface BillingInvoicePdfData {
  id: string;
  number: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  clientAddress?: string;
  clientTaxId?: string;
  planName: string;
  planInterval: string;
  seats: number;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: string;
  notes?: string;
  issuedAt: Date;
  dueDate?: Date;
}

const BRAND = { primary: '#1a56db', dark: '#111827', gray: '#6b7280', light: '#f3f4f6', lightBlue: '#93c5fd', white: '#ffffff' };

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, size = 32): void {
  const s = size / 48, r = 6 * s;
  doc.roundedRect(x, y, size, size, r).fill(BRAND.primary);
  doc.rect(x + 10 * s, y + 8 * s, 4 * s, 22 * s).fill(BRAND.white);
  doc.moveTo(x + 14 * s, y + 8 * s).lineTo(x + 22 * s, y + 8 * s)
     .quadraticCurveTo(x + 28 * s, y + 8 * s, x + 28 * s, y + 16 * s)
     .quadraticCurveTo(x + 28 * s, y + 24 * s, x + 22 * s, y + 24 * s).lineTo(x + 14 * s, y + 24 * s).fill(BRAND.white);
  doc.rect(x + 22 * s, y + 16 * s, 3 * s, 18 * s).fill(BRAND.lightBlue);
  doc.moveTo(x + 25 * s, y + 16 * s).lineTo(x + 31 * s, y + 16 * s)
     .quadraticCurveTo(x + 36 * s, y + 16 * s, x + 36 * s, y + 22 * s)
     .quadraticCurveTo(x + 36 * s, y + 28 * s, x + 31 * s, y + 28 * s).lineTo(x + 25 * s, y + 28 * s).fill(BRAND.lightBlue);
}

export async function generateBillingInvoicePdf(invoice: BillingInvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = 515, C = { desc: 50, qty: 310, price: 375, total: 455 };
    const fmt = (n: number) => n.toLocaleString('es-CR', { style: 'currency', currency: invoice.currency });
    const statusColor: Record<string, string> = { PAID: '#16a34a', SENT: BRAND.primary, DRAFT: BRAND.gray, OVERDUE: '#dc2626', VOID: '#9ca3af' };

    // Header
    doc.rect(50, 40, W, 88).fill(BRAND.primary);
    drawLogo(doc, 65, 52, 36);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(22).text('Pymes', 110, 60, { continued: true }).fillColor(BRAND.lightBlue).text('Hub');
    doc.fillColor(BRAND.white).font('Helvetica').fontSize(7.5).text('PLATAFORMA SAAS PARA PYMES  ·  COSTA RICA', 110, 85);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(22).text('FACTURA', 0, 55, { align: 'right' });
    doc.fontSize(9).font('Helvetica').text(`N° ${invoice.number}`, 0, 83, { align: 'right' }).text(`Emitida: ${invoice.issuedAt.toLocaleDateString('es-CR')}`, 0, 96, { align: 'right' });
    doc.rect(50, 128, W, 2).fill(BRAND.lightBlue);

    // Client
    let y = 148;
    doc.fillColor(BRAND.primary).font('Helvetica-Bold').fontSize(7.5).text('FACTURAR A', 50, y);
    y += 12; doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(10.5).text(invoice.clientName, 50, y);
    y += 14; doc.font('Helvetica').fontSize(9).fillColor(BRAND.dark);
    if (invoice.clientCompany) { doc.text(invoice.clientCompany, 50, y); y += 12; }
    if (invoice.clientAddress) { doc.text(invoice.clientAddress, 50, y); y += 12; }
    if (invoice.clientTaxId) { doc.fillColor(BRAND.gray).text(`Cédula: ${invoice.clientTaxId}`, 50, y); y += 12; }
    doc.fillColor(BRAND.gray).text(invoice.clientEmail, 50, y);

    // Status + Plan
    doc.roundedRect(380, 148, 90, 22, 4).fill(statusColor[invoice.status] ?? BRAND.gray);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(8.5).text(invoice.status, 380, 155, { width: 90, align: 'center' });
    doc.roundedRect(355, 178, 210, 52, 6).fill(BRAND.light);
    doc.fillColor(BRAND.primary).font('Helvetica-Bold').fontSize(7.5).text('PLAN', 368, 186);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(10).text(invoice.planName, 368, 198);
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(8).text(`${invoice.planInterval === 'MONTHLY' ? 'Mensual' : 'Anual'} · ${invoice.seats} asiento(s)`, 368, 212);
    if (invoice.dueDate) doc.text(`Vence: ${invoice.dueDate.toLocaleDateString('es-CR')}`, 368, 224);

    // Table
    const tTop = 248;
    doc.rect(50, tTop, W, 22).fill(BRAND.dark);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(8.5)
       .text('DESCRIPCIÓN', C.desc + 4, tTop + 6).text('CANT.', C.qty, tTop + 6)
       .text('PRECIO UNIT.', C.price, tTop + 6, { width: 68, align: 'right' })
       .text('TOTAL', C.total, tTop + 6, { width: 60, align: 'right' });

    let rY = tTop + 24;
    invoice.lineItems.forEach((item, idx) => {
      doc.rect(50, rY, W, 22).fill(idx % 2 === 0 ? BRAND.light : BRAND.white);
      doc.rect(50, rY, 3, 22).fill(BRAND.primary);
      doc.fillColor(BRAND.dark).font('Helvetica').fontSize(8.5)
         .text(item.description, C.desc + 4, rY + 6, { width: 248 })
         .text(String(item.quantity), C.qty, rY + 6)
         .text(fmt(item.unitPrice), C.price, rY + 6, { width: 68, align: 'right' })
         .font('Helvetica-Bold').text(fmt(item.total), C.total, rY + 6, { width: 60, align: 'right' });
      rY += 24;
    });

    // Totals
    rY += 12; const tX = 350;
    doc.rect(tX, rY - 6, 215, 1).fill(BRAND.light);
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(9).text('Subtotal', tX, rY, { width: 110 }).text(fmt(invoice.subtotal), tX + 110, rY, { width: 105, align: 'right' });
    if (invoice.taxRate > 0) { rY += 18; doc.text(`IVA (${invoice.taxRate}%)`, tX, rY, { width: 110 }).text(fmt(invoice.taxAmount), tX + 110, rY, { width: 105, align: 'right' }); }
    rY += 18; doc.rect(tX - 8, rY - 5, 228, 30).fill(BRAND.primary);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(12).text('TOTAL', tX, rY + 3, { width: 110 }).text(fmt(invoice.total), tX + 110, rY + 3, { width: 105, align: 'right' });

    // Notes
    if (invoice.notes) { rY += 50; doc.roundedRect(50, rY, W, 1).fill(BRAND.light); rY += 8; doc.fillColor(BRAND.primary).font('Helvetica-Bold').fontSize(7.5).text('NOTAS', 50, rY); doc.fillColor(BRAND.gray).font('Helvetica').fontSize(8.5).text(invoice.notes, 50, rY + 12, { width: W }); }

    // Footer
    doc.rect(50, 762, W, 3).fill(BRAND.primary); doc.rect(50, 765, W, 1).fill(BRAND.lightBlue);
    drawLogo(doc, 50, 772, 18);
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(7)
       .text('PymeHub — Automatización para PYMES en Costa Rica y LATAM', 76, 776, { align: 'center', width: W - 26 })
       .text('support@pymeshub.com  ·  www.pymeshub.lat', 76, 786, { align: 'center', width: W - 26 });
    doc.end();
  });
}
