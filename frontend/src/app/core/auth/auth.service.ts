import { Injectable, inject } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { BehaviorSubject, filter, firstValueFrom, take } from 'rxjs';
import { FirebaseAppService } from '../firebase/firebase-app.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly googleProvider = new GoogleAuthProvider();
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  private readonly readySubject = new BehaviorSubject(false);

  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly ready$ = this.readySubject.asObservable();

  constructor() {
    this.googleProvider.setCustomParameters({ prompt: 'select_account' });

    if (!this.firebase.enabled || !this.firebase.auth) {
      this.readySubject.next(true);
      return;
    }

    onAuthStateChanged(this.firebase.auth, (user) => {
      this.currentUserSubject.next(user);
      this.readySubject.next(true);
    });
  }

  get enabled(): boolean {
    return this.firebase.enabled;
  }

  get currentUser(): User | null {
    return (
      this.currentUserSubject.value ?? this.firebase.auth?.currentUser ?? null
    );
  }

  async waitUntilReady(): Promise<void> {
    if (this.readySubject.value) return;
    await firstValueFrom(
      this.readySubject.pipe(filter((ready) => ready), take(1)),
    );
  }

  /** Procesa el retorno de signInWithRedirect (Google). */
  async handleRedirectResult(): Promise<boolean> {
    if (!this.firebase.auth) return false;

    const result = await getRedirectResult(this.firebase.auth);
    if (!result?.user) return false;

    this.currentUserSubject.next(result.user);
    return true;
  }

  async login(email: string, password: string): Promise<void> {
    if (!this.firebase.auth) {
      throw new Error('Firebase Auth no está configurado');
    }

    const credential = await signInWithEmailAndPassword(
      this.firebase.auth,
      email.trim(),
      password,
    );
    this.currentUserSubject.next(credential.user);
  }

  async loginWithGoogle(): Promise<void> {
    if (!this.firebase.auth) {
      throw new Error('Firebase Auth no está configurado');
    }

    try {
      const credential = await signInWithPopup(
        this.firebase.auth,
        this.googleProvider,
      );
      this.currentUserSubject.next(credential.user);
    } catch (error) {
      const code = this.firebaseErrorCode(error);
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(this.firebase.auth, this.googleProvider);
        return;
      }
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (!this.firebase.auth) return;
    await signOut(this.firebase.auth);
    this.currentUserSubject.next(null);
  }

  async getIdToken(): Promise<string | null> {
    const user = this.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  private firebaseErrorCode(error: unknown): string {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
    ) {
      return (error as { code: string }).code;
    }
    return '';
  }
}
