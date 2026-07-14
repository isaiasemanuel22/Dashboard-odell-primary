import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FILE_STORAGE } from './file-storage.interface';
import type { FileStorage } from './file-storage.interface';
import { UPLOADS_DIR } from './upload.paths';
import {
  isAllowedImageExtension,
  validateUploadedImage,
} from './upload.validation';

@Controller('upload')
export class UploadController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
          if (!isAllowedImageExtension(file.originalname)) {
            cb(new BadRequestException('Extensión de archivo no permitida'), '');
            return;
          }
          const extension = extname(file.originalname).toLowerCase();
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extension}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Solo se permiten imágenes'),
            false,
          );
        }
        if (!isAllowedImageExtension(file.originalname)) {
          return cb(
            new BadRequestException('Extensión de archivo no permitida'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    this.storage.ensureReady();

    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    const validation = validateUploadedImage(file);
    if (!validation.ok) {
      this.storage.deleteFile(file.path);
      throw new BadRequestException(validation.reason);
    }

    return { url: this.storage.saveUploadedFile(file).publicUrl };
  }
}
