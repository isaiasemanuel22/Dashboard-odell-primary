import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { CurrentUserResponse } from '../models';
import { FormDialogService } from '../../modals/form-dialog.service';
import type { IndependentTaskDialogResult } from '../../modals/independent-task-dialog.component';
import { UserAccessService } from './user-access.service';

/**
 * «Nueva tarea» de la cola: resuelve responsables y usuario actual y abre el diálogo.
 * Lo usan la cola (botón) y el «+» del layout en `/cola`.
 */
@Injectable({ providedIn: 'root' })
export class IndependentTaskFlowService {
  private readonly userAccess = inject(UserAccessService);
  private readonly formDialogs = inject(FormDialogService);

  pick(): Observable<IndependentTaskDialogResult | undefined> {
    const cachedUid = sessionFirebaseUid(this.userAccess.peekCurrentUser());
    const uid$ = cachedUid
      ? of(cachedUid)
      : this.userAccess.loadCurrentUser().pipe(
          map((profile) => sessionFirebaseUid(profile)),
          catchError(() => of('')),
        );
    return uid$.pipe(
      switchMap((uid) =>
        this.userAccess.listOrderResponsibles().pipe(
          catchError(() => of([])),
          switchMap((responsibles) =>
            this.formDialogs.openIndependentTask({
              responsibles,
              defaultResponsibleId: uid,
            }),
          ),
        ),
      ),
    );
  }
}

function sessionFirebaseUid(profile: CurrentUserResponse | null): string {
  if (!profile || !('firebaseUid' in profile)) return '';
  return profile.firebaseUid ?? '';
}
