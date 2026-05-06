import { Global, Module } from '@nestjs/common';
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
        if (driver === 's3' || driver === 'minio') {
          const accessKey = config.get<string>('STORAGE_ACCESS_KEY');
          const secretKey = config.get<string>('STORAGE_SECRET_KEY');
          if (!accessKey || !secretKey) {
            throw new Error(
              'STORAGE_DRIVER is set to s3/minio but STORAGE_ACCESS_KEY or STORAGE_SECRET_KEY is missing. ' +
              'Set the credentials or change STORAGE_DRIVER to "local".',
            );
          }
          return new StorageService(config);
        }
        return new LocalStorageService(config) as any;
      },
      inject: [ConfigService],
    },
    LocalStorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
