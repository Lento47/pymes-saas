import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

interface ColumnMapping {
  [targetField: string]: string; // targetField → csvColumnName
}

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /** Parse CSV buffer and return headers + preview rows */
  parseCsv(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) throw new BadRequestException('CSV debe tener al menos encabezado y una fila');

    const headers = this.parseCsvLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
      rows.push(row);
    }

    return { headers, rows };
  }

  /** Import contacts from CSV with column mapping */
  async importContacts(
    workspaceId: string,
    mapping: ColumnMapping,
    rows: Record<string, string>[],
  ): Promise<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;
    let skipped = 0;

    // Check plan limit once before loop instead of per-row (N calls → 1 call)
    const evalResult = await this.planLimits.evaluatePlanLimit(workspaceId, 'contacts', rows.length);
    if (!evalResult.allowed) {
      return { imported: 0, skipped: rows.length, errors: [{ row: 0, reason: evalResult.message ?? 'Límite de contactos alcanzado' }] };
    }

    for (let i = 0; i < rows.length; i++) {
      try {
        const contactData: Record<string, any> = {
          workspace_id: workspaceId,
          full_name: this.getMapped(mapping, rows[i], 'full_name', ''),
          type: 'CUSTOMER' as const,
        };

        const company = this.getMapped(mapping, rows[i], 'company_name', '');
        if (company) contactData.company_name = company;

        const email = this.getMapped(mapping, rows[i], 'email', '');
        if (email) contactData.email = email;

        const phone = this.getMapped(mapping, rows[i], 'phone', '');
        if (phone) contactData.phone = phone;

        const tags = this.getMapped(mapping, rows[i], 'tags', '');
        if (tags) contactData.tags_json = JSON.stringify(tags.split(',').map(t => t.trim()));

        if (!contactData.email && !contactData.phone) {
          errors.push({ row: i + 1, reason: 'Se requiere email o teléfono' });
          skipped++;
          continue;
        }

        await this.prisma.contact.create({ data: contactData as any });
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, reason: err.message ?? 'Error desconocido' });
        skipped++;
      }
    }

    this.logger.log(`CSV contact import: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped, errors };
  }

  /** Import invoices from CSV with column mapping */
  async importInvoices(
    workspaceId: string,
    mapping: ColumnMapping,
    rows: Record<string, string>[],
  ): Promise<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        const amount = parseFloat(this.getMapped(mapping, rows[i], 'amount', '0'));
        if (isNaN(amount) || amount <= 0) {
          errors.push({ row: i + 1, reason: 'Monto inválido' });
          skipped++;
          continue;
        }

        const evalResult = await this.planLimits.evaluatePlanLimit(workspaceId, 'invoices_per_month', 1);
        if (!evalResult.allowed) {
          errors.push({ row: i + 1, reason: evalResult.message ?? 'Límite de facturas alcanzado' });
          skipped++;
          continue;
        }

        const number = this.getMapped(mapping, rows[i], 'number', `CSV-${Date.now()}-${i}`);
        const dueDate = this.getMapped(mapping, rows[i], 'due_date', '');
        const contactName = this.getMapped(mapping, rows[i], 'contact_name', '');
        const currency = this.getMapped(mapping, rows[i], 'currency', 'CRC');
        const description = this.getMapped(mapping, rows[i], 'description', '');

        // Try to match contact by name or email
        let contactId: string | null = null;
        if (contactName) {
          const contact = await this.prisma.contact.findFirst({
            where: {
              workspace_id: workspaceId,
              OR: [
                { full_name: { contains: contactName, mode: 'insensitive' as any } },
                { company_name: { contains: contactName, mode: 'insensitive' as any } },
              ],
            },
            select: { id: true },
          });
          contactId = contact?.id ?? null;
        }

        // If no contact match, create a basic one
        if (!contactId) {
          const c = await this.prisma.contact.create({
            data: {
              workspace_id: workspaceId,
              full_name: contactName || 'Cliente CSV',
              type: 'CUSTOMER',
            },
          });
          contactId = c.id;
        }

        await this.prisma.invoice.create({
          data: {
            workspace_id: workspaceId,
            contact_id: contactId,
            number,
            amount,
            currency,
            status: 'DRAFT',
            due_date: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            issue_date: new Date(),
            description: description || undefined,
            document_type: 'FACTURA_ELECTRONICA',
          },
        });
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, reason: err.message ?? 'Error desconocido' });
        skipped++;
      }
    }

    this.logger.log(`CSV invoice import: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped, errors };
  }

  /** Import products (inventory) from CSV with column mapping */
  async importProducts(
    workspaceId: string,
    mapping: ColumnMapping,
    rows: Record<string, string>[],
  ): Promise<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;
    let skipped = 0;

    // Pre-fetch categories for name→id mapping
    const categories = await this.prisma.productCategory.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    for (let i = 0; i < rows.length; i++) {
      try {
        const name = this.getMapped(mapping, rows[i], 'name', '');
        if (!name) {
          errors.push({ row: i + 1, reason: 'Nombre del producto requerido' });
          skipped++;
          continue;
        }

        const unitPrice = parseFloat(this.getMapped(mapping, rows[i], 'unit_price', '0'));
        if (isNaN(unitPrice) || unitPrice < 0) {
          errors.push({ row: i + 1, reason: 'Precio unitario inválido' });
          skipped++;
          continue;
        }

        const evalResult = await this.planLimits.evaluatePlanLimit(workspaceId, 'products', 1);
        if (!evalResult.allowed) {
          errors.push({ row: i + 1, reason: evalResult.message ?? 'Límite de productos alcanzado' });
          skipped++;
          continue;
        }

        let sku = this.getMapped(mapping, rows[i], 'sku', '');
        if (!sku) sku = `SKU-${Date.now()}-${i}`;

        // Check for duplicate SKU
        const existingSku = await this.prisma.product.findFirst({
          where: { workspace_id: workspaceId, sku },
          select: { id: true },
        });
        if (existingSku) {
          errors.push({ row: i + 1, reason: `SKU "${sku}" ya existe` });
          skipped++;
          continue;
        }

        const categoryName = this.getMapped(mapping, rows[i], 'category', '');
        let categoryId: string | null = null;
        if (categoryName) {
          categoryId = categoryMap.get(categoryName.toLowerCase()) ?? null;
          // Auto-create category if not found
          if (!categoryId) {
            const cat = await this.prisma.productCategory.create({
              data: { workspace_id: workspaceId, name: categoryName },
            });
            categoryId = cat.id;
            categoryMap.set(categoryName.toLowerCase(), cat.id);
          }
        }

        const costPrice = this.getMapped(mapping, rows[i], 'cost_price', '');
        const stock = parseInt(this.getMapped(mapping, rows[i], 'current_stock', '0')) || 0;
        const minStock = parseInt(this.getMapped(mapping, rows[i], 'min_stock', '0')) || 0;
        const unitMeasure = this.getMapped(mapping, rows[i], 'unit_of_measure', '');
        const description = this.getMapped(mapping, rows[i], 'description', '');

        await this.prisma.product.create({
          data: {
            workspace_id: workspaceId,
            name,
            sku,
            unit_price: unitPrice,
            cost_price: costPrice && !isNaN(parseFloat(costPrice)) ? parseFloat(costPrice) : undefined,
            current_stock: stock,
            min_stock: minStock,
            unit_of_measure: unitMeasure || undefined,
            description: description || undefined,
            category_id: categoryId,
            type: 'PRODUCT',
          },
        });
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, reason: err.message ?? 'Error desconocido' });
        skipped++;
      }
    }

    this.logger.log(`CSV product import: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped, errors };
  }

  private getMapped(mapping: ColumnMapping, row: Record<string, string>, targetField: string, defaultValue: string): string {
    const csvCol = mapping[targetField];
    if (!csvCol) return defaultValue;
    return (row[csvCol] ?? defaultValue).trim();
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }
}
