import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";

// Required child elements per Hacienda CR document type (V4.3 XSD spec)
const REQUIRED_ELEMENTS: Record<string, string[]> = {
  FacturaElectronica: [
    "Clave",
    "NumeroConsecutivo",
    "FechaEmision",
    "Emisor",
    "Receptor",
    "CondicionVenta",
    "MedioPago",
    "DetalleServicio",
    "ResumenFactura",
  ],
  TiqueteElectronico: [
    "Clave",
    "NumeroConsecutivo",
    "FechaEmision",
    "Emisor",
    "CondicionVenta",
    "MedioPago",
    "DetalleServicio",
    "ResumenFactura",
  ],
  NotaCreditoElectronica: [
    "Clave",
    "NumeroConsecutivo",
    "FechaEmision",
    "Emisor",
    "Receptor",
    "CondicionVenta",
    "MedioPago",
    "DetalleServicio",
    "ResumenFactura",
    "InformacionReferencia",
  ],
  NotaDebitoElectronica: [
    "Clave",
    "NumeroConsecutivo",
    "FechaEmision",
    "Emisor",
    "Receptor",
    "CondicionVenta",
    "MedioPago",
    "DetalleServicio",
    "ResumenFactura",
    "InformacionReferencia",
  ],
  MensajeReceptor: [
    "Clave",
    "NumeroCedulaEmisor",
    "FechaEmisionDoc",
    "Mensaje",
    "DetalleMensaje",
    "MontoTotalImpuesto",
    "TotalFactura",
  ],
};

@Injectable()
export class HaciendaXmlValidatorService {
  private readonly logger = new Logger(HaciendaXmlValidatorService.name);

  /**
   * Validates a Hacienda CR fiscal XML document before submission.
   * Checks:
   *   1. Well-formedness via xmllint --noout
   *   2. Required child elements for the detected document type
   *   3. Clave length (must be exactly 50 digits) if present
   */
  validate(xml: string): void {
    this.checkWellFormed(xml);

    const rootTag = this.detectRootTag(xml);
    if (!rootTag) {
      throw new BadRequestException("XML fiscal no tiene elemento raíz reconocible.");
    }

    const required = REQUIRED_ELEMENTS[rootTag];
    if (!required) {
      // Unknown root — let Hacienda reject it; don't block unknown doc types
      this.logger.warn(`Tipo de documento no reconocido para validación local: ${rootTag}`);
      return;
    }

    const missing = required.filter((el) => !xml.includes(`<${el}>`));
    if (missing.length) {
      throw new BadRequestException(
        `XML fiscal incompleto (${rootTag}): faltan elementos requeridos: ${missing.join(", ")}.`,
      );
    }

    // Spot-check Clave length
    const claveMatch = xml.match(/<Clave>(\d+)<\/Clave>/);
    if (claveMatch && claveMatch[1].length !== 50) {
      throw new BadRequestException(
        `La Clave fiscal tiene ${claveMatch[1].length} dígitos; se esperan exactamente 50.`,
      );
    }
  }

  private checkWellFormed(xml: string): void {
    const tmpFile = path.join(os.tmpdir(), `hacienda-validate-${Date.now()}.xml`);
    try {
      fs.writeFileSync(tmpFile, xml, "utf8");
      execFileSync("xmllint", ["--noout", tmpFile], { timeout: 5_000, stdio: "pipe" });
    } catch (err) {
      const msg = (err as any)?.stderr?.toString?.() ?? (err as Error).message ?? "XML mal formado";
      throw new BadRequestException(`XML fiscal mal formado: ${msg.split("\n")[0]}`);
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        /* cleanup */
      }
    }
  }

  private detectRootTag(xml: string): string | null {
    // Skip XML declaration and find the first element tag
    const match = xml.match(/<\?xml[^?]*\?>\s*<([A-Za-z][A-Za-z0-9]*)[\s>]/);
    if (match) return match[1];
    const fallback = xml.match(/<([A-Za-z][A-Za-z0-9]*)[\s>]/);
    return fallback ? fallback[1] : null;
  }
}
