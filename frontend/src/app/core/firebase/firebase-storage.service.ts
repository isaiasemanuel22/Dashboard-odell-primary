import { Injectable, inject } from '@angular/core';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { FirebaseAppService } from './firebase-app.service';

@Injectable({ providedIn: 'root' })
export class FirebaseStorageService {
  private readonly firebase = inject(FirebaseAppService);

  get enabled(): boolean {
    return this.firebase.enabled && !!this.firebase.storage;
  }

  async uploadProductImage(file: File): Promise<string> {
    if (!this.firebase.storage) {
      throw new Error('Firebase Storage no está configurado');
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const objectPath = `products/${Date.now()}-${safeName}`;
    const objectRef = ref(this.firebase.storage, objectPath);

    await uploadBytes(objectRef, file, {
      contentType: file.type,
    });

    return getDownloadURL(objectRef);
  }
}
