import { Injectable, inject } from '@angular/core';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { BehaviorSubject, filter, firstValueFrom, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FirebaseAppService } from '../firebase/firebase-app.service';

/** Campos que usa la app. El usuario de Firebase los cumple. */
interface SessionUser {
  email: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

const LOCAL_TEST_EMAIL = 'testing@test.com';
const LOCAL_TEST_PASSWORD = '123456';
const LOCAL_TEST_SESSION_KEY = 'odell.localTestSession';

const LOCAL_TEST_USER: SessionUser = {
  email: LOCAL_TEST_EMAIL,
  getIdToken: () => Promise.resolve(''),
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly googleProvider = new GoogleAuthProvider();
  private readonly currentUserSubject = new BehaviorSubject<SessionUser | null>(
    null,
  );
  private readonly readySubject = new BehaviorSubject(false);
  private localTestSession = false;

  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly ready$ = this.readySubject.asObservable();

  constructor() {
    this.googleProvider.setCustomParameters({ prompt: 'select_account' });

    this.restoreLocalTestSession();

    if (!this.firebase.enabled || !this.firebase.auth) {
      this.readySubject.next(true);
      return;
    }

    onAuthStateChanged(this.firebase.auth, (user) => {
      if (this.localTestSession) {
        this.readySubject.next(true);
        return;
      }

      this.currentUserSubject.next(user);
      this.readySubject.next(true);
    });
  }

  get enabled(): boolean {
    return this.firebase.enabled;
  }

  get currentUser(): SessionUser | null {
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
    if (this.acceptsLocalTestLogin(email, password)) {
      this.activateLocalTestSession();
      return;
    }

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
    this.clearLocalTestSession();
    if (this.firebase.auth) {
      await signOut(this.firebase.auth);
    }
    this.currentUserSubject.next(null);
  }

  async getIdToken(): Promise<string | null> {
    if (this.localTestSession) return null;
    const user = this.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  /** Ingreso local, solo fuera de producción. No llama a Firebase. */
  private acceptsLocalTestLogin(email: string, password: string): boolean {
    return (
      !environment.production &&
      email.trim().toLowerCase() === LOCAL_TEST_EMAIL &&
      password === LOCAL_TEST_PASSWORD
    );
  }

  private restoreLocalTestSession(): void {
    if (environment.production) return;
    if (sessionStorage.getItem(LOCAL_TEST_SESSION_KEY) !== '1') return;
    this.activateLocalTestSession();
  }

  private activateLocalTestSession(): void {
    this.localTestSession = true;
    sessionStorage.setItem(LOCAL_TEST_SESSION_KEY, '1');
    this.currentUserSubject.next(LOCAL_TEST_USER);
    this.readySubject.next(true);
  }

  private clearLocalTestSession(): void {
    this.localTestSession = false;
    sessionStorage.removeItem(LOCAL_TEST_SESSION_KEY);
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
