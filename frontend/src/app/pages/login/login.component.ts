import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { authErrorMessage } from '../../core/auth/auth-error.util';
import { isFirebaseConfigured } from '../../../environments/firebase.config';
import { environment } from '../../../environments/environment';
import { DbButtonComponent } from '@general-components';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, DbButtonComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly firebaseConfigured = isFirebaseConfigured(environment.firebase);

  email = '';
  password = '';
  loading = false;
  error = '';

  async ngOnInit(): Promise<void> {
    if (!this.firebaseConfigured) return;

    this.loading = true;
    try {
      const fromRedirect = await this.auth.handleRedirectResult();
      if (fromRedirect) {
        await this.router.navigateByUrl('/dashboard');
      }
    } catch (err) {
      this.error = authErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.firebaseConfigured || this.loading) return;

    this.loading = true;
    this.error = '';

    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      this.error = authErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  async loginWithGoogle(): Promise<void> {
    if (!this.firebaseConfigured || this.loading) return;

    this.loading = true;
    this.error = '';

    try {
      await this.auth.loginWithGoogle();
      if (this.auth.currentUser) {
        await this.router.navigateByUrl('/dashboard');
      }
    } catch (err) {
      this.error = authErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }
}
