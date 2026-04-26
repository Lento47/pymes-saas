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

    // A4 = 595pt wide, margins 48+48=96, content = 499pt
    const M = 48;
    const W = 499;
    const fmt = (n: number) => {
      if (invoice.currency === 'CRC') {
        return `₡${n.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
      }
      return n.toLocaleString('en-US', { style: 'currency', currency: invoice.currency, minimumFractionDigits: 2 });
    };
    const statusColor: Record<string, string> = { PAID: BRAND.success, SENT: BRAND.primary, DRAFT: BRAND.gray, OVERDUE: BRAND.danger, VOID: BRAND.grayLight };

    // ═══════ HEADER ═══════
    doc.rect(M, 30, W, 80).fill(BRAND.primary);

    // Logo
    drawLogo(doc, logo, M + 16, 42, 32, 32);

    // Company name
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(18).text('PymeHub', M + 58, 44);
    doc.fillColor(BRAND.primaryLight).font('Helvetica').fontSize(6.5)
      .text('Plataforma SaaS para PYMES · Costa Rica', M + 58, 65)
      .text('support@pymeshub.com  ·  pymeshub.lat', M + 58, 76);

    // Invoice title — right-aligned, padded from edge
    const rightX = M + W - 140;
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(24).text('FACTURA', rightX, 38, { width: 140, align: 'right' });
    doc.font('Helvetica').fontSize(7.5);
    let ry = 66;
    doc.text(`N° ${invoice.number}`, rightX, ry, { width: 140, align: 'right' }); ry += 11;
    doc.text(`Emitida: ${invoice.issuedAt.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, rightX, ry, { width: 140, align: 'right' }); ry += 11;
    if (invoice.dueDate) {
      doc.text(`Vence: ${invoice.dueDate.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, rightX, ry, { width: 140, align: 'right' });
    }

    // Header bottom accent
    doc.rect(M, 110, W, 1.5).fill(BRAND.primaryLight);

    // ═══════ CLIENT + STATUS ═══════
    let y = 128;

    // Client block
    doc.roundedRect(M, y, 280, 44, 4).fill(BRAND.light);
    doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(6.5).text('FACTURAR A', M + 12, y + 8);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(10.5).text(invoice.clientName, M + 12, y + 20);
    if (invoice.clientCompany) {
      doc.fillColor(BRAND.gray).font('Helvetica').fontSize(7.5).text(invoice.clientCompany, M + 12, y + 34);
    }
    if (invoice.clientEmail) {
      doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(7).text(invoice.clientEmail, 330, y + 28, { width: 210, align: 'right' });
    }

    // Status badge — positioned in the top-right of client area
    doc.roundedRect(M + W - 78, y + 4, 72, 20, 3).fill(statusColor[invoice.status] ?? BRAND.gray);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(8).text(invoice.status, M + W - 78, y + 9, { width: 72, align: 'center' });

    y += 56;

    // Plan details
    doc.roundedRect(M, y, W, 40, 4).fill(BRAND.primaryLight);
    doc.fillColor(BRAND.primary).font('Helvetica-Bold').fontSize(7).text('PLAN', M + 14, y + 8);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(11).text(invoice.planName, M + 14, y + 19);
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(7.5)
      .text(`${invoice.planInterval === 'MONTHLY' ? 'Facturación Mensual' : 'Facturación Anual'} · ${invoice.seats} usuario(s)`, M + 14, y + 33);

    // ═══════ TABLE ═══════
    y += 56;
    const cols = { desc: M, qty: 300, price: 365, totalRight: M + W - 10 };

    // Table header
    doc.rect(M, y, W, 22).fill(BRAND.dark);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(7.5)
      .text('DESCRIPCIÓN', cols.desc + 8, y + 6)
      .text('CANT.', cols.qty, y + 6, { width: 40, align: 'center' })
      .text('PRECIO UNIT.', cols.price, y + 6, { width: 80, align: 'right' })
      .text('TOTAL', cols.totalRight - 70, y + 6, { width: 70, align: 'right' });

    y += 24;

    // Table rows
    invoice.lineItems.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? BRAND.white : BRAND.light;
      doc.rect(M, y, W, 24).fill(bg);
      doc.rect(M, y, 3, 24).fill(BRAND.primary);

      doc.fillColor(BRAND.dark).font('Helvetica').fontSize(8)
        .text(item.description, cols.desc + 12, y + 6, { width: 210 })
        .text(String(item.quantity), cols.qty, y + 6, { width: 40, align: 'center' })
        .text(fmt(item.unitPrice), cols.price, y + 6, { width: 90, align: 'right' })
        .font('Helvetica-Bold').text(fmt(item.total), cols.totalRight - 78, y + 6, { width: 78, align: 'right' });

      y += 26;
    });

    // Table border bottom
    doc.rect(M, y, W, 0.5).fill(BRAND.border);
    y += 8;

    // ═══════ TOTALS ═══════
    const totX = 340;
    const totW = M + W - totX;

    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(9)
      .text('Subtotal', totX, y, { width: 80 })
      .text(fmt(invoice.subtotal), totX + 80, y, { width: totW - 80, align: 'right' });

    if (invoice.taxRate > 0) {
      y += 20;
      doc.text(`IVA (${invoice.taxRate}%)`, totX, y, { width: 80 })
        .text(fmt(invoice.taxAmount), totX + 80, y, { width: totW - 80, align: 'right' });
    }

    y += 22;
    doc.rect(totX - 4, y - 3, totW + 4, 30).fill(BRAND.primary);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(12)
      .text('TOTAL', totX + 4, y + 4, { width: 80 })
      .text(fmt(invoice.total), totX + 80, y + 4, { width: totW - 84, align: 'right' });

    // ═══════ NOTES ═══════
    if (invoice.notes) {
      y += 50;
      doc.rect(M, y, W, 0.5).fill(BRAND.border);
      y += 12;
      doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(7).text('NOTAS', M, y);
      doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(8).text(invoice.notes, M, y + 12, { width: W });
    }

    // ═══════ FOOTER ═══════
    const footerY = 740;
    doc.rect(M, footerY, W, 1).fill(BRAND.primary);
    doc.rect(M, footerY + 1, W, 0.5).fill(BRAND.primaryLight);

    drawLogo(doc, logo, M, footerY + 10, 20, 20);
    doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(6.5)
      .text('PymeHub — Automatización para PYMES en Costa Rica y LATAM', M + 28, footerY + 7, { width: W - 28, align: 'center' })
      .text('support@pymeshub.com  ·  pymeshub.lat  ·  Factura generada electrónicamente', M + 28, footerY + 18, { width: W - 28, align: 'center' });

    doc.end();
  });
}
