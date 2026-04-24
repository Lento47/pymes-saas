import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class HaciendaSigningService {
  constructor(private readonly prisma: PrismaService) {}

  async signXml(workspaceId: string, xml: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings =
      workspace?.settings_json && typeof workspace.settings_json === 'object'
        ? (workspace.settings_json as Record<string, any>)
        : {};

    const signingEnabled = settings.hacienda_signing_enabled === true;
    if (!signingEnabled) {
      return {
        signedXml: xml,
        signatureMode: 'UNSIGNED_PLACEHOLDER',
      };
    }

    return {
      signedXml: `${xml}\n<!-- Signature placeholder: integrate XAdES-EPES signer here -->`,
      signatureMode: 'PLACEHOLDER',
    };
  }
}
