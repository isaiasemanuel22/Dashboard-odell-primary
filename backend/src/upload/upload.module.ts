import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { FILE_STORAGE } from './file-storage.interface';
import { FirebaseFileStorageService } from './firebase-file-storage.service';
import { LocalFileStorageService } from './local-file-storage.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [
    LocalFileStorageService,
    FirebaseFileStorageService,
    {
      provide: FILE_STORAGE,
      useFactory: (
        config: AppConfigService,
        firebaseAdmin: FirebaseAdminService,
        local: LocalFileStorageService,
        firebase: FirebaseFileStorageService,
      ) => {
        if (
          config.productImageStorage === 'firebase' &&
          firebaseAdmin.isEnabled()
        ) {
          return firebase;
        }
        return local;
      },
      inject: [
        AppConfigService,
        FirebaseAdminService,
        LocalFileStorageService,
        FirebaseFileStorageService,
      ],
    },
  ],
  exports: [FILE_STORAGE, LocalFileStorageService, FirebaseFileStorageService],
})
export class UploadModule {}
