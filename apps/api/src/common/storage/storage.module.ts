import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: StorageService,
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER') ?? 'local';
        const bucket = config.get<string>('STORAGE_BUCKET') ?? 'pymes-documents';
        Logger.log(`Storage driver: ${driver}`, 'StorageModule');
        Logger.log(`Storage bucket: ${bucket}`, 'StorageModule');
        if (driver === 's3' || driver === 'minio') {
          const accessKey = config.get<string>('STORAGE_ACCESS_KEY');
          const secretKey = config.get<string>('STORAGE_SECRET_KEY');
          const endpoint = config.get<string>('STORAGE_ENDPOINT') ?? 'auto';
          Logger.log(`Storage endpoint: ${endpoint}`, 'StorageModule');
          if (!accessKey || !secretKey) {
            throw new Error(
              'STORAGE_DRIVER is set to s3/minio but STORAGE_ACCESS_KEY or STORAGE_SECRET_KEY is missing. ' +
              'Set the credentials or change STORAGE_DRIVER to "local".',
            );
          }
          return new StorageService(config);
        }
        Logger.log('Storage using local filesystem', 'StorageModule');
        return new LocalStorageService(config) as any;
      },
      inject: [ConfigService],
    },
    LocalStorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
