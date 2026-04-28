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

    for (let i = 0; i < rows.length; i++) {
      try {
        const contactData: any = {
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

        // Check plan limit
        const evalResult = await this.planLimits.evaluatePlanLimit(workspaceId, 'contacts', 1);
        if (!evalResult.allowed) {
          errors.push({ row: i + 1, reason: evalResult.message ?? 'Límite de contactos alcanzado' });
          skipped++;
          continue;
        }

        await this.prisma.contact.create({ data: contactData });
        imported++;
      } catch (err: any) {
        errors.push({ row: i + 1, reason: err.message ?? 'Error desconocido' });
        skipped++;
      }
    }

    this.logger.log(`CSV contact import: ${imported} imported, ${skipped} skipped`);
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
