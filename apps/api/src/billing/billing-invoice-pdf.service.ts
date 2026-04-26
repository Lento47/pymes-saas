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
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(w * 0.35).text('PH', x + 2, y + h * 0.2, { width: w - 4, align: 'center' });
  }
}

export async function generateBillingInvoicePdf(invoice: BillingInvoicePdfData): Promise<Buffer> {
  const logo = await getLogoBuffer();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = 495;
    const fmt = (n: number) => n.toLocaleString('es-CR', { style: 'currency', currency: invoice.currency, minimumFractionDigits: 2 });
    const statusColor: Record<string, string> = { PAID: BRAND.success, SENT: BRAND.primary, DRAFT: BRAND.gray, OVERDUE: BRAND.danger, VOID: BRAND.grayLight };

    // ═══════ HEADER ═══════
    doc.rect(50, 30, W, 95).fill(BRAND.primary);

    // Logo
    drawLogo(doc, logo, 70, 50, 42, 42);

    // Company name
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(21).text('PymeHub', 125, 52);
    doc.fillColor(BRAND.primaryLight).font('Helvetica').fontSize(7.5).text('Plataforma SaaS para PYMES · Costa Rica', 125, 76);

    // Contact info in header
    doc.fillColor(BRAND.primaryLight).fontSize(6.5)
      .text('support@pymeshub.com', 125, 90)
      .text('www.pymeshub.lat', 370, 90, { align: 'right' });

    // Invoice title
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(26).text('FACTURA', 0, 42, { align: 'right' });
    doc.font('Helvetica').fontSize(8.5)
      .text(`N° ${invoice.number}`, 0, 72, { align: 'right' })
      .text(`Emitida: ${invoice.issuedAt.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, 0, 84, { align: 'right' });

    if (invoice.dueDate) {
      doc.text(`Vence: ${invoice.dueDate.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, 0, 96, { align: 'right' });
    }

    // Subtle bottom accent on header
    doc.rect(50, 125, W, 2).fill(BRAND.primaryLight);

    // ═══════ CLIENT + STATUS ═══════
    let y = 145;

    // Client block
    doc.roundedRect(50, y, 240, 52, 4).fill(BRAND.light);
    doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(7).text('FACTURAR A', 62, y + 8);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(11).text(invoice.clientName, 62, y + 20);
    let cy = y + 34;
    if (invoice.clientEmail) {
      doc.fillColor(BRAND.gray).font('Helvetica').fontSize(8).text(invoice.clientEmail, 62, cy);
      cy += 11;
    }
    if (invoice.clientCompany) {
      doc.fontSize(8).text(invoice.clientCompany, 62, cy);
    }

    // Status badge
    doc.roundedRect(370, y, 80, 24, 4).fill(statusColor[invoice.status] ?? BRAND.gray);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(9).text(invoice.status, 370, y + 7, { width: 80, align: 'center' });

    // Plan details
    y += 62;
    doc.roundedRect(50, y, W, 44, 4).fill(BRAND.primaryLight);
    doc.fillColor(BRAND.primary).font('Helvetica-Bold').fontSize(7.5).text('PLAN', 64, y + 8);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(11).text(invoice.planName, 64, y + 20);
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(8)
      .text(`${invoice.planInterval === 'MONTHLY' ? 'Facturación Mensual' : 'Facturación Anual'} · ${invoice.seats} usuario(s)`, 64, y + 34);

    // ═══════ TABLE ═══════
    y += 62;
    const tX = 50;
    const cols = { desc: tX, qty: 310, price: 370, total: 460 };

    // Table header
    doc.rect(tX, y, W, 24).fill(BRAND.dark);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(8)
      .text('DESCRIPCIÓN', cols.desc + 8, y + 7)
      .text('CANT.', cols.qty, y + 7, { width: 50, align: 'center' })
      .text('PRECIO UNIT.', cols.price, y + 7, { width: 80, align: 'right' })
      .text('TOTAL', cols.total, y + 7, { width: 75, align: 'right' });

    y += 26;

    // Table rows
    invoice.lineItems.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? BRAND.white : BRAND.light;
      doc.rect(tX, y, W, 26).fill(bg);
      doc.rect(tX, y, 3, 26).fill(BRAND.primary);

      doc.fillColor(BRAND.dark).font('Helvetica').fontSize(8.5)
        .text(item.description, cols.desc + 12, y + 7, { width: 230 })
        .text(String(item.quantity), cols.qty, y + 7, { width: 50, align: 'center' })
        .text(fmt(item.unitPrice), cols.price, y + 7, { width: 80, align: 'right' })
        .font('Helvetica-Bold').text(fmt(item.total), cols.total, y + 7, { width: 75, align: 'right' });

      y += 28;
    });

    // Table border bottom
    doc.rect(tX, y, W, 0.5).fill(BRAND.border);
    y += 6;

    // ═══════ TOTALS ═══════
    const totX = 330;
    y += 4;
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(9)
      .text('Subtotal', totX, y, { width: 100 })
      .text(fmt(invoice.subtotal), totX + 100, y, { width: 115, align: 'right' });

    if (invoice.taxRate > 0) {
      y += 20;
      doc.text(`IVA (${invoice.taxRate}%)`, totX, y, { width: 100 })
        .text(fmt(invoice.taxAmount), totX + 100, y, { width: 115, align: 'right' });
    }

    y += 22;
    doc.rect(totX - 4, y - 4, 219, 32).fill(BRAND.primary);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(13)
      .text('TOTAL', totX, y + 3, { width: 100 })
      .text(fmt(invoice.total), totX + 100, y + 3, { width: 115, align: 'right' });

    // ═══════ NOTES ═══════
    if (invoice.notes) {
      y += 55;
      doc.rect(tX, y, W, 0.5).fill(BRAND.border);
      y += 12;
      doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(7.5).text('NOTAS', tX, y);
      doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(8.5).text(invoice.notes, tX, y + 14, { width: W });
    }

    // ═══════ FOOTER ═══════
    const footerY = 740;
    doc.rect(50, footerY, W, 1).fill(BRAND.primary);
    doc.rect(50, footerY + 1, W, 0.5).fill(BRAND.primaryLight);

    drawLogo(doc, logo, 50, footerY + 10, 22, 22);
    doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(7)
      .text('PymeHub — Automatización para PYMES en Costa Rica y LATAM', 80, footerY + 8, { width: W - 30, align: 'center' })
      .text('support@pymeshub.com  ·  www.pymeshub.lat  ·  Factura generada electrónicamente', 80, footerY + 20, { width: W - 30, align: 'center' });

    doc.end();
  });
}
