import { Module } from '@nestjs/common';
import { FILE_STORAGE } from './file-storage.interface';
import { LocalFileStorageService } from './local-file-storage.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [
    LocalFileStorageService,
    {
      provide: FILE_STORAGE,
      useExisting: LocalFileStorageService,
    },
  ],
  exports: [FILE_STORAGE, LocalFileStorageService],
})
export class UploadModule {}
