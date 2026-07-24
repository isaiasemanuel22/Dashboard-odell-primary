import { Logger, Module } from '@nestjs/common';
import { FILE_STORAGE } from './file-storage.interface';
import { FirebaseFileStorageService } from './firebase-file-storage.service';
import { UploadController } from './upload.controller';

const uploadLogger = new Logger('UploadModule');
uploadLogger.log('Imágenes de productos → Firebase Storage');

@Module({
  controllers: [UploadController],
  providers: [
    FirebaseFileStorageService,
    {
      provide: FILE_STORAGE,
      useExisting: FirebaseFileStorageService,
    },
  ],
  exports: [FILE_STORAGE, FirebaseFileStorageService],
})
export class UploadModule {}
