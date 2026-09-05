import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AppRole,
  AppUser,
  CurrentUserResponse,
  WorkArea,
} from '../models';

export interface CreateWorkAreaPayload {
  name: string;
  slug?: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateWorkAreaPayload extends Partial<CreateWorkAreaPayload> {}

export interface CreateAppRolePayload {
  name: string;
  description?: string;
  permissions?: Array<{ action: string; areaId?: string | null }>;
}

export interface UpdateAppRolePayload extends Partial<CreateAppRolePayload> {}

export interface CreateAppUserPayload {
  email: string;
  displayName: string;
  firebaseUid?: string;
  active?: boolean;
  roleIds?: string[];
}

export interface UpdateAppUserPayload {
  email?: string;
  displayName?: string;
  firebaseUid?: string | null;
  active?: boolean;
  roleIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class UserAccessService {
  private readonly baseUrl = `${environment.apiUrl}/user-access`;
  private readonly http = inject(HttpClient);
  private readonly currentUserSubject =
    new BehaviorSubject<CurrentUserResponse | null>(null);

  readonly currentUser$ = this.currentUserSubject.asObservable();

  peekCurrentUser(): CurrentUserResponse | null {
    return this.currentUserSubject.value;
  }

  loadCurrentUser(): Observable<CurrentUserResponse> {
    return this.http.get<CurrentUserResponse>(`${this.baseUrl}/me`).pipe(
      tap((profile) => this.currentUserSubject.next(profile)),
    );
  }

  listWorkAreas(): Observable<WorkArea[]> {
    return this.http.get<WorkArea[]>(`${this.baseUrl}/work-areas`);
  }

  createWorkArea(data: CreateWorkAreaPayload): Observable<WorkArea> {
    return this.http.post<WorkArea>(`${this.baseUrl}/work-areas`, data);
  }

  updateWorkArea(id: string, data: UpdateWorkAreaPayload): Observable<WorkArea> {
    return this.http.patch<WorkArea>(`${this.baseUrl}/work-areas/${id}`, data);
  }

  deleteWorkArea(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/work-areas/${id}`,
    );
  }

  listRoles(): Observable<AppRole[]> {
    return this.http.get<AppRole[]>(`${this.baseUrl}/roles`);
  }

  createRole(data: CreateAppRolePayload): Observable<AppRole> {
    return this.http.post<AppRole>(`${this.baseUrl}/roles`, data);
  }

  updateRole(id: string, data: UpdateAppRolePayload): Observable<AppRole> {
    return this.http.patch<AppRole>(`${this.baseUrl}/roles/${id}`, data);
  }

  deleteRole(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/roles/${id}`);
  }

  listUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.baseUrl}/users`);
  }

  createUser(data: CreateAppUserPayload): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.baseUrl}/users`, data);
  }

  updateUser(id: string, data: UpdateAppUserPayload): Observable<AppUser> {
    return this.http.patch<AppUser>(`${this.baseUrl}/users/${id}`, data);
  }

  deleteUser(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/users/${id}`);
  }
}
