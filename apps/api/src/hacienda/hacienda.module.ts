import { Module } from '@nestjs/common';
import { HaciendaController } from './hacienda.controller';
import { HaciendaWebhookController } from './hacienda-webhook.controller';
import { HaciendaAuthService } from './hacienda-auth.service';
import { HaciendaPublicApiService } from './hacienda-public-api.service';
import { HaciendaRecepcionService } from './hacienda-recepcion.service';
import { HaciendaSigningService } from './hacienda-signing.service';
import { HaciendaXmlBuilderService } from './hacienda-xml-builder.service';
import { FiscalSequenceService } from './fiscal-sequence.service';
import { FiscalCertificateService } from './fiscal-certificate.service';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  controllers: [HaciendaController, HaciendaWebhookController],
  providers: [
    HaciendaAuthService,
    HaciendaPublicApiService,
    HaciendaRecepcionService,
    HaciendaSigningService,
    HaciendaXmlBuilderService,
    FiscalSequenceService,
    FiscalCertificateService,
  ],
  exports: [
    HaciendaAuthService,
    HaciendaPublicApiService,
    HaciendaRecepcionService,
    HaciendaSigningService,
    HaciendaXmlBuilderService,
    FiscalSequenceService,
    FiscalCertificateService,
  ],
})
export class HaciendaModule {}
