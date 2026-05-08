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

// Black & white invoice palette. The PymesHub logo (separate image at
// LOGO_URL) is the only branded element. Status badges and totals lose
// their semantic colour cues — the text itself ("PAID", "OVERDUE")
// carries the distinction.
const BRAND = {
  primary: '#000000',
  primaryLight: '#f3f4f6',
  dark: '#000000',
  gray: '#4b5563',
  grayLight: '#9ca3af',
  light: '#f8fafc',
  white: '#ffffff',
  border: '#d1d5db',
  success: '#000000',
  danger: '#000000',
};

const LOGO_URL = 'https://raw.githubusercontent.com/Lento47/PymesHub-invoice/refs/heads/master/PymesHubic.png';

let logoBuffer: Buffer | null = null;

async function getLogoBuffer(): Promise<Buffer | null> {
  if (logoBuffer) return logoBuffer;
  try {
    const res = await fetch(LOGO_URL, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    logoBuffer = Buffer.from(await res.arrayBuffer());
    return logoBuffer;
  } catch { return null; }
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

    const PAGE_W = 595.28;
    const M = 48;
    const W = PAGE_W - M * 2;

    const fmt = (n: number) => {
      if (invoice.currency === 'CRC') {
        return `CRC ${n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    const statusColor: Record<string, string> = { PAID: BRAND.success, SENT: BRAND.primary, DRAFT: BRAND.gray, OVERDUE: BRAND.danger, VOID: BRAND.grayLight };

    // ═══════ HEADER ═══════
    const headerH = 82;
    doc.rect(M, 28, W, headerH).fill(BRAND.primary);

    drawLogo(doc, logo, M + 16, 42, 32, 32);

    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(18).text('PymesHub', M + 58, 42);
    doc.fillColor(BRAND.primaryLight).font('Helvetica').fontSize(6.5)
      .text('Plataforma SaaS para PYMES · Costa Rica', M + 58, 63)
      .text('support@pymeshub.lat  ·  PymesHub.lat', M + 58, 74);

    // Invoice title — right-aligned from left margin
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(22)
      .text('FACTURA', M, 36, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(7).fillColor(BRAND.white);
    let ry = 62;
    doc.text(`N° ${invoice.number}`, M, ry, { width: W, align: 'right', lineBreak: false }); ry += 11;
    doc.text(`Emitida: ${invoice.issuedAt.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, M, ry, { width: W, align: 'right', lineBreak: false });
    if (invoice.dueDate) {
      ry += 11;
      doc.text(`Vence: ${invoice.dueDate.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}`, M, ry, { width: W, align: 'right', lineBreak: false });
    }

    // Status badge inside header — top-right, below title line
    const badgeW = 54;
    const badgeH = 17;
    const badgeX = M + W - badgeW - 4;
    const badgeY = 88;
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3)
      .fillColor(statusColor[invoice.status] ?? BRAND.gray)
      .fill();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND.white)
      .text(invoice.status, badgeX, badgeY + 4, { width: badgeW, align: 'center' });

    doc.rect(M, 110, W, 1.5).fill(BRAND.primaryLight);

    // ═══════ CLIENT + PLAN (side by side) ═══════
    let y = 126;
    const cardW = W / 2 - 8;
    const cardH = 52;

    // Client card
    doc.roundedRect(M, y, cardW, cardH, 4).fill(BRAND.light);
    doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(6.5).text('FACTURAR A', M + 12, y + 9);
    let cy = y + 22;
    const fields = [
      invoice.clientName,
      invoice.clientEmail,
      invoice.clientCompany,
    ].filter(Boolean) as string[];
    fields.forEach((f) => {
      const isEmail = f.includes('@');
      doc.font(isEmail ? 'Helvetica' : 'Helvetica-Bold')
        .fontSize(isEmail ? 7 : 9.5)
        .fillColor(isEmail ? BRAND.grayLight : BRAND.dark)
        .text(f, M + 12, cy, { width: cardW - 80, lineBreak: false });
      cy += 12;
    });

    // Plan card (right side)
    const planX = M + cardW + 16;
    doc.roundedRect(planX, y, cardW, cardH, 4).fill(BRAND.primaryLight);
    doc.fillColor(BRAND.primary).font('Helvetica-Bold').fontSize(6.5).text('PLAN', planX + 12, y + 9);
    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(10).text(invoice.planName, planX + 12, y + 22);
    doc.fillColor(BRAND.gray).font('Helvetica').fontSize(7)
      .text(`${invoice.planInterval === 'MONTHLY' ? 'Mensual' : 'Anual'} · ${invoice.seats} usuario(s)`, planX + 12, y + 36);

    // ═══════ TABLE ═══════
    y += cardH + 16;
    const rowH = 22;

    // Header
    doc.rect(M, y, W, rowH).fill(BRAND.dark);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(7)
      .text('DESCRIPCIÓN', M + 12, y + 5)
      .text('CANT.', M + 300, y + 5, { width: 40, align: 'center' })
      .text('PRECIO UNIT.', M + 360, y + 5, { width: 85, align: 'right' })
      .text('TOTAL', M, y + 5, { width: W, align: 'right' });

    y += rowH + 2;

    invoice.lineItems.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? BRAND.white : BRAND.light;
      doc.rect(M, y, W, rowH).fill(bg);
      doc.fillColor(BRAND.dark).font('Helvetica').fontSize(8)
        .text(item.description, M + 12, y + 4, { width: 250, lineBreak: false })
        .text(String(item.quantity), M + 300, y + 4, { width: 40, align: 'center' })
        .text(fmt(item.unitPrice), M + 360, y + 4, { width: 85, align: 'right' })
        .font('Helvetica-Bold').text(fmt(item.total), M, y + 4, { width: W, align: 'right' });
      y += rowH + 2;
    });

    doc.rect(M, y + 4, W, 0.5).fill(BRAND.border);
    y += 12;

    // ═══════ TOTALS ═══════
    const totLabelW = 90;
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.gray)
      .text('Subtotal', M, y, { width: totLabelW })
      .text(fmt(invoice.subtotal), M, y, { width: W, align: 'right' });

    if (invoice.taxRate > 0) {
      y += 20;
      doc.text(`IVA (${invoice.taxRate}%)`, M, y, { width: totLabelW })
        .text(fmt(invoice.taxAmount), M, y, { width: W, align: 'right' });
    }

    y += 24;
    doc.rect(M, y - 3, W, 28).fill(BRAND.primary);
    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(12)
      .text('TOTAL', M + 8, y + 3, { width: totLabelW })
      .text(fmt(invoice.total), M, y + 3, { width: W - 8, align: 'right' });

    // ═══════ NOTES ═══════
    if (invoice.notes) {
      y += 48;
      doc.moveTo(M, y).lineTo(M + W, y).strokeColor(BRAND.border).lineWidth(0.5).stroke();
      y += 12;
      doc.fillColor(BRAND.gray).font('Helvetica-Bold').fontSize(7).text('NOTAS', M, y);
      doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(8).text(invoice.notes, M, y + 12, { width: W });
    }

    // ═══════ FOOTER ═══════
    const footerY = 744;
    doc.moveTo(M, footerY).lineTo(M + W, footerY).strokeColor(BRAND.primary).lineWidth(1).stroke();
    doc.moveTo(M, footerY + 1.5).lineTo(M + W, footerY + 1.5).strokeColor(BRAND.primaryLight).lineWidth(0.5).stroke();

    drawLogo(doc, logo, M, footerY + 10, 18, 18);
    doc.fillColor(BRAND.grayLight).font('Helvetica').fontSize(6)
      .text('PymesHub — Automatización para PYMES en Costa Rica y LATAM', M + 26, footerY + 8, { width: W - 26, align: 'center' })
      .text('support@pymeshub.lat  ·  PymesHub.lat  ·  Factura electrónica', M + 26, footerY + 18, { width: W - 26, align: 'center' });

    doc.end();
  });
}
