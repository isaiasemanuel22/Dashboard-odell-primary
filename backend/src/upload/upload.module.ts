import { Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { FILE_STORAGE } from './file-storage.interface';
import { FirebaseFileStorageService } from './firebase-file-storage.service';
import { LocalFileStorageService } from './local-file-storage.service';
import { UploadController } from './upload.controller';

const uploadLogger = new Logger('UploadModule');

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
        const wantsFirebase = config.productImageStorage === 'firebase';

        if (wantsFirebase) {
          if (!firebaseAdmin.isEnabled()) {
            const message =
              'PRODUCT_IMAGE_STORAGE=firebase pero Firebase Admin no está configurado';
            if (config.isProduction) {
              throw new Error(message);
            }
            uploadLogger.warn(`${message}. Usando disco local (/uploads).`);
            return local;
          }
          uploadLogger.log('Imágenes de productos → Firebase Storage');
          return firebase;
        }

        uploadLogger.log('Imágenes de productos → disco local (/uploads)');
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
