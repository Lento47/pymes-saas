import { Global, Module } from '@nestjs/common';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { RemoteObjectStorageService } from './remote-object-storage.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, LocalDiskStorageService, RemoteObjectStorageService],
  exports: [StorageService],
})
export class StorageModule {}
