import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FirebaseStorageService } from '../firebase/firebase-storage.service';
import { ProductsService } from './products.service';

@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private readonly firebaseStorage = inject(FirebaseStorageService);
  private readonly productsService = inject(ProductsService);

  uploadProductImage(file: File): Observable<string> {
    if (this.usesFirebaseStorage()) {
      return from(this.firebaseStorage.uploadProductImage(file)).pipe(
        catchError(() => this.uploadViaBackend(file)),
      );
    }
    return this.uploadViaBackend(file);
  }

  usesFirebaseStorage(): boolean {
    return (
      environment.productImageStorage === 'firebase' &&
      this.firebaseStorage.enabled
    );
  }

  private uploadViaBackend(file: File): Observable<string> {
    return this.productsService
      .uploadImage(file)
      .pipe(map((result) => result.url));
  }
}
