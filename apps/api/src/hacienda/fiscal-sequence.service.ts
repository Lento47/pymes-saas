import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import * as crypto from 'crypto';

// Hacienda CR document type codes per official specification
export const HACIENDA_DOC_TYPE_CODES: Record<string, string> = {
  FACTURA_ELECTRONICA: '01',
  NOTA_DEBITO: '02',
  NOTA_CREDITO: '03',
  TIQUETE_ELECTRONICO: '04',
  MENSAJE_RECEPTOR: '05',
};

@Injectable()
export class FiscalSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next consecutivo for a workspace in a single atomic transaction.
   * Format: {sucursal(3)}{terminal(5)}{tipoDoc(2)}{número(10)} = 20 digits
   *
   * Uses upsert + increment so concurrent requests can't produce duplicates.
   */
  async nextConsecutivo(params: {
    workspaceId: string;
    documentType: string;
    branchCode?: string;
    terminalCode?: string;
  }): Promise<string> {
    const branchCode = (params.branchCode ?? '001').padStart(3, '0').slice(0, 3);
    const terminalCode = (params.terminalCode ?? '00001').padStart(5, '0').slice(0, 5);
    const docCode = HACIENDA_DOC_TYPE_CODES[params.documentType];

    if (!docCode) {
      throw new BadRequestException(`Tipo de documento fiscal no soportado: ${params.documentType}`);
    }

    const sequence = await this.prisma.$transaction(async (tx) => {
      return tx.fiscalSequence.upsert({
        where: {
          workspace_id_branch_code_terminal_code_document_type: {
            workspace_id: params.workspaceId,
            branch_code: branchCode,
            terminal_code: terminalCode,
            document_type: params.documentType as any,
          },
        },
        create: {
          workspace_id: params.workspaceId,
          branch_code: branchCode,
          terminal_code: terminalCode,
          document_type: params.documentType as any,
          current_number: 1,
        },
        update: {
          current_number: { increment: 1 },
        },
      });
    });

    const sequenceNumber = sequence.current_number.toString().padStart(10, '0');
    const consecutivo = `${branchCode}${terminalCode}${docCode}${sequenceNumber}`;

    if (consecutivo.length !== 20) {
      throw new Error(`Consecutivo generado con longitud incorrecta: ${consecutivo}`);
    }

    return consecutivo;
  }

  /**
   * Generates the Hacienda CR 50-digit clave fiscal.
   * Format: 506(3) + DDMMAA(6) + cédula(12) + consecutivo(20) + situación(1) + código_seguridad(8) = 50
   *
   * IMPORTANT: The consecutivo must be generated first via nextConsecutivo()
   * and then passed here. Never generate clave without a locked consecutivo.
   */
  generateClave(params: {
    issueDate: Date;
    issuerIdentification: string;
    consecutivo: string;
    situation?: '1' | '2' | '3';
    securityCode?: string;
  }): string {
    const d = params.issueDate;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);

    const cedula = params.issuerIdentification
      .replace(/\D/g, '')
      .padStart(12, '0')
      .slice(-12);

    const consecutivo = params.consecutivo.padStart(20, '0').slice(0, 20);
    const situacion = params.situation ?? '1';
    const codigoSeguridad = (
      params.securityCode ?? crypto.randomInt(10_000_000, 99_999_999).toString()
    )
      .padStart(8, '0')
      .slice(0, 8);

    const clave = `506${dd}${mm}${yy}${cedula}${consecutivo}${situacion}${codigoSeguridad}`;

    if (clave.length !== 50 || !/^\d{50}$/.test(clave)) {
      throw new Error(
        `Clave generada inválida (${clave.length} dígitos, se esperaban 50): cedula="${cedula}" consecutivo="${consecutivo}"`,
      );
    }

    return clave;
  }
}
