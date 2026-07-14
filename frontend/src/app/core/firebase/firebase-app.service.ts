import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';
import { isFirebaseConfigured } from '../../../environments/firebase.config';

@Injectable({ providedIn: 'root' })
export class FirebaseAppService {
  readonly enabled = isFirebaseConfigured(environment.firebase);
  readonly app: FirebaseApp | null;
  readonly auth: Auth | null;
  readonly storage: FirebaseStorage | null;

  constructor() {
    if (!this.enabled || !environment.firebase) {
      this.app = null;
      this.auth = null;
      this.storage = null;
      return;
    }

    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    this.storage = getStorage(this.app);
  }
}
