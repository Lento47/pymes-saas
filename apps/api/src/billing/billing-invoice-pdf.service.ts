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

const BRAND = {
  primary: '#1a56db',
  primaryLight: '#e8f0fe',
  dark: '#111827',
  gray: '#6b7280',
  grayLight: '#9ca3af',
  light: '#f8fafc',
  white: '#ffffff',
  border: '#e5e7eb',
  success: '#16a34a',
  danger: '#dc2626',
};

const LOGO_URL = 'https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/pymesHubic.png';

let logoBuffer: Buffer | null = null;

async function getLogoBuffer(): Promise<Buffer | null> {
  if (logoBuffer) return logoBuffer;
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    logoBuffer = Buffer.from(arrayBuffer);
    return logoBuffer;
  } catch {
    return null;
  }
}

function drawLogo(doc: PDFKit.PDFDocument, logo: Buffer | null, x: number, y: number, w: number, h: number): void {
  if (logo) {
    doc.image(logo, x, y, { width: w, height: h });
  } else {
    doc.roundedRect(x, y, w, h, 6).fill(BRAND.primary);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(w * 0.3).text('PH', x + 2, y + h * 0.2, { width: w - 4, align: 'center' });
  }
}

export async function generateBillingInvoicePdf(invoice: BillingInvoicePdfData): Promise<Buffer> {
  const logo = await getLogoBuffer();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const M = 48;
    const W = 499;
    const fmt = (n: number) => {
      if (invoice.currency === 'CRC') {
        return `CRC ${n.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
      }
      return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    };
    const statusColor: Record<string, string> = { PAID: BRAND.success, SENT: BRAND.primary, DRAFT: BRAND.gray, OVERDUE: BRAND.danger, VOID: BRAND.grayLight };

    // ═══════ HEADER ═══════
    doc.rect(M, 28, W, 80).fill(BRAND.primary);

    drawLogo(doc, logo, M + 16, 40, 32, 32);

    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(18).text('PymeHub', M + 58, 42);
    doc.fillColor(BRAND.primaryLight).font('Helvetica').fontSize(6.5)
      .text('Plataforma SaaS para PYMES · Costa Rica', M + 58, 63)
      .text('support@pymeshub.com  ·  pymeshub.lat', M + 58, 74);

    // Invoice title — right side, within safe zone
    const rightW = 170;
    const rightX = M + W - rightW - 8;
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(22).text('FACTURA', rightX, 36, { width: rightW, align: 'right' });
    doc.font('Helvetica').fontSize(7);
    let ry = 64;
    doc.text(`N° ${invoice.number}`, rightX, ry, { width: rightW, align: 'right', lineBreak: false }); ry += 10;
    doc.text(`Emitida: ${invoice.issuedAt.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, rightX, ry, { width: rightW, align: 'right', lineBreak: false }); ry += 10;
    if (invoice.dueDate) {
      doc.text(`Vence: ${invoice.dueDate.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, rightX, ry, { width: rightW, align: 'right', lineBreak: false });
    }

    doc.rect(M, 108, W, 1.5).fill(BRAND.primaryLight);

    // ═══════ CLIENT + PLAN (side by side) ═══════
    let y = 124;
    const cardW = W / 2 - 6;

    // Client
    doc.roundedRect(M, y, cardW, 46, 4).fill(BRAND.light);
    doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(6.5).text('FACTURAR A', M + 12, y + 8);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(10).text(invoice.clientName || 'Cliente', M + 12, y + 20);
    if (invoice.clientEmail) {
      doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(7).text(invoice.clientEmail, M + 12, y + 34);
    }
    if (invoice.clientAddress) {
      doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(7).text(invoice.clientAddress, M + 12, y + 42);
    }

    // Status badge — inline with client card, at right edge of card
    doc.roundedRect(M + cardW - 70, y + 6, 62, 18, 3).fill(statusColor[invoice.status] ?? BRAND.gray);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(7.5).text(invoice.status, M + cardW - 70, y + 10, { width: 62, align: 'center' });

    // Plan (right side)
    const planX = M + cardW + 12;
    doc.roundedRect(planX, y, cardW, 46, 4).fill(BRAND.primaryLight);
    doc.fillColor(BRAND.primary).font('Helvetica-Bold').fontSize(6.5).text('PLAN', planX + 12, y + 8);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(10).text(invoice.planName, planX + 12, y + 20);
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(7)
      .text(`${invoice.planInterval === 'MONTHLY' ? 'Facturación Mensual' : 'Facturación Anual'} · ${invoice.seats} usuario(s)`, planX + 12, y + 34);

    // ═══════ TABLE ═══════
    y += 62;
    const cols = {
      desc: M,
      qty: 290,
      price: 350,
      total: M + W - 10,
    };

    // Header
    doc.rect(M, y, W, 20).fill(BRAND.dark);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(7)
      .text('DESCRIPCIÓN', cols.desc + 10, y + 5)
      .text('CANT.', cols.qty, y + 5, { width: 40, align: 'center' })
      .text('PRECIO UNIT.', cols.price, y + 5, { width: 80, align: 'right' })
      .text('TOTAL', cols.total - 74, y + 5, { width: 74, align: 'right' });

    y += 22;

    // Rows
    invoice.lineItems.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? BRAND.white : BRAND.light;
      doc.rect(M, y, W, 22).fill(bg);
      doc.rect(M, y, 2.5, 22).fill(BRAND.primary);
      doc.fillColor(BRAND.dark).font('Helvetica').fontSize(7.5)
        .text(item.description, cols.desc + 14, y + 5, { width: 210 })
        .text(String(item.quantity), cols.qty, y + 5, { width: 40, align: 'center' })
        .text(fmt(item.unitPrice), cols.price, y + 5, { width: 88, align: 'right' })
        .font('Helvetica-Bold').text(fmt(item.total), cols.total - 82, y + 5, { width: 82, align: 'right' });
      y += 24;
    });

    y += 4;
    doc.rect(M, y, W, 0.5).fill(BRAND.border);
    y += 6;

    // ═══════ TOTALS ═══════
    const totX = 340;
    const totW = M + W - totX - 6;

    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(8.5)
      .text('Subtotal', totX + 6, y, { width: 70 })
      .text(fmt(invoice.subtotal), totX + 70, y, { width: totW - 70, align: 'right' });

    if (invoice.taxRate > 0) {
      y += 18;
      doc.text(`IVA (${invoice.taxRate}%)`, totX + 6, y, { width: 70 })
        .text(fmt(invoice.taxAmount), totX + 70, y, { width: totW - 70, align: 'right' });
    }

    y += 22;
    doc.rect(totX, y - 3, totW + 6, 28).fill(BRAND.primary);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(11)
      .text('TOTAL', totX + 8, y + 4, { width: 70 })
      .text(fmt(invoice.total), totX + 70, y + 4, { width: totW - 78, align: 'right' });

    // ═══════ NOTES ═══════
    if (invoice.notes) {
      y += 48;
      doc.rect(M, y, W, 0.5).fill(BRAND.border);
      y += 12;
      doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(7).text('NOTAS', M, y);
      doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(8).text(invoice.notes, M, y + 12, { width: W });
    }

    // ═══════ FOOTER ═══════
    const footerY = 742;
    doc.rect(M, footerY, W, 0.8).fill(BRAND.primary);
    doc.rect(M, footerY + 1, W, 0.4).fill(BRAND.primaryLight);

    drawLogo(doc, logo, M, footerY + 8, 18, 18);
    doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(6)
      .text('PymeHub — Automatización para PYMES en Costa Rica y LATAM', M + 26, footerY + 6, { width: W - 26, align: 'center' })
      .text('support@pymeshub.com  ·  pymeshub.lat  ·  Factura electrónica', M + 26, footerY + 16, { width: W - 26, align: 'center' });

    doc.end();
  });
}
