import {
  Controller, Post, Body, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CsvImportService } from './csv-import.service';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CsvImportController {
  constructor(private readonly csvImport: CsvImportService) {}

  @Post('contacts/parse')
  @Roles('ADMIN', 'OWNER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async parseContactsCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo CSV requerido');
    const { headers, rows } = this.csvImport.parseCsv(file.buffer);

    // Suggest column mapping
    const suggestedMapping: Record<string, string> = {};
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      if (lower.includes('nombre') || lower.includes('name') || lower.includes('full')) suggestedMapping.full_name = h;
      else if (lower.includes('email') || lower.includes('correo')) suggestedMapping.email = h;
      else if (lower.includes('telefono') || lower.includes('phone') || lower.includes('tel')) suggestedMapping.phone = h;
      else if (lower.includes('empresa') || lower.includes('company') || lower.includes('razon')) suggestedMapping.company_name = h;
      else if (lower.includes('tag') || lower.includes('etiqueta')) suggestedMapping.tags = h;
    }

    return {
      headers,
      suggestedMapping,
      rows: rows.slice(0, 8), // preview first 8 rows
      totalRows: rows.length,
    };
  }

  @Post('contacts/confirm')
  @Roles('ADMIN', 'OWNER')
  async confirmContactsImport(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() data: { mapping: Record<string, string>; rows: Record<string, string>[] },
  ) {
    if (!data.mapping || !data.rows?.length) throw new BadRequestException('Mapping y rows requeridos');
    return this.csvImport.importContacts(workspaceId, data.mapping, data.rows);
  }

  // ─── Invoice CSV Import ───────────────────────────────────────────

  @Post('invoices/parse')
  @Roles('ADMIN', 'OWNER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async parseInvoicesCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo CSV requerido');
    const { headers, rows } = this.csvImport.parseCsv(file.buffer);

    const suggestedMapping: Record<string, string> = {};
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      if (lower.includes('numero') || lower.includes('number')) suggestedMapping.number = h;
      else if (lower.includes('monto') || lower.includes('amount') || lower.includes('total')) suggestedMapping.amount = h;
      else if (lower.includes('cliente') || lower.includes('contact') || lower.includes('nombre')) suggestedMapping.contact_name = h;
      else if (lower.includes('fecha') || lower.includes('venc')) suggestedMapping.due_date = h;
      else if (lower.includes('moneda') || lower.includes('currency')) suggestedMapping.currency = h;
      else if (lower.includes('descrip')) suggestedMapping.description = h;
    }

    return { headers, suggestedMapping, rows: rows.slice(0, 8), totalRows: rows.length };
  }

  @Post('invoices/confirm')
  @Roles('ADMIN', 'OWNER')
  async confirmInvoicesImport(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() data: { mapping: Record<string, string>; rows: Record<string, string>[] },
  ) {
    if (!data.mapping || !data.rows?.length) throw new BadRequestException('Mapping y rows requeridos');
    return this.csvImport.importInvoices(workspaceId, data.mapping, data.rows);
  }

  // ─── Product CSV Import ──────────────────────────────────────────

  @Post('products/parse')
  @Roles('ADMIN', 'OWNER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async parseProductsCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo CSV requerido');
    const { headers, rows } = this.csvImport.parseCsv(file.buffer);

    const suggestedMapping: Record<string, string> = {};
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      if (lower.includes('nombre') || lower.includes('name') || lower.includes('producto')) suggestedMapping.name = h;
      else if (lower.includes('sku') || lower.includes('codigo') || lower.includes('código')) suggestedMapping.sku = h;
      else if (lower.includes('precio') || lower.includes('price') || lower.includes('unitario')) suggestedMapping.unit_price = h;
      else if (lower.includes('costo') || lower.includes('cost')) suggestedMapping.cost_price = h;
      else if (lower.includes('stock') || lower.includes('existencia') || lower.includes('cantidad')) suggestedMapping.current_stock = h;
      else if (lower.includes('minimo') || lower.includes('mínimo') || lower.includes('min')) suggestedMapping.min_stock = h;
      else if (lower.includes('categoria') || lower.includes('categoría') || lower.includes('category')) suggestedMapping.category = h;
      else if (lower.includes('unidad') || lower.includes('medida') || lower.includes('unit')) suggestedMapping.unit_of_measure = h;
      else if (lower.includes('descrip') || lower.includes('detalle')) suggestedMapping.description = h;
    }

    return { headers, suggestedMapping, rows: rows.slice(0, 8), totalRows: rows.length };
  }

  @Post('products/confirm')
  @Roles('ADMIN', 'OWNER')
  async confirmProductsImport(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() data: { mapping: Record<string, string>; rows: Record<string, string>[] },
  ) {
    if (!data.mapping || !data.rows?.length) throw new BadRequestException('Mapping y rows requeridos');
    return this.csvImport.importProducts(workspaceId, data.mapping, data.rows);
  }
}
