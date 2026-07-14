import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { FirebaseStorageService } from '../firebase/firebase-storage.service';
import { ProductsService } from './products.service';

@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private readonly firebaseStorage = inject(FirebaseStorageService);
  private readonly productsService = inject(ProductsService);

  uploadProductImage(file: File): Observable<string> {
    if (this.firebaseStorage.enabled) {
      return from(this.firebaseStorage.uploadProductImage(file));
    }

    return this.productsService
      .uploadImage(file)
      .pipe(map((result) => result.url));
  }
}
