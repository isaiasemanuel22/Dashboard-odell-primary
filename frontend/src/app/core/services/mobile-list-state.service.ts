import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BreakpointService } from './breakpoint.service';

/** Estado mínimo de lista mobile: siempre incluye scrollY. */
export interface MobileListScrollState {
  scrollY: number;
}

/** Claves de las listas de la familia A. */
export const MOBILE_LIST_KEYS = {
  orders: 'orders',
  quotes: 'quotes',
  customers: 'customers',
  products: 'products',
  supplies: 'supplies',
  printJobs: 'print-jobs',
} as const;

export type MobileListKey =
  (typeof MOBILE_LIST_KEYS)[keyof typeof MOBILE_LIST_KEYS];

/**
 * Guarda/lee en memoria el estado de una lista mobile (filtros, búsqueda, scroll)
 * al navegar al detalle y volver.
 */
@Injectable({ providedIn: 'root' })
export class MobileListStateService {
  private readonly byKey = new Map<string, unknown>();

  save<T extends MobileListScrollState>(key: string, state: T): void {
    this.byKey.set(key, cloneState(state));
  }

  read<T extends MobileListScrollState>(key: string): T | null {
    const saved = this.byKey.get(key);
    if (saved == null) return null;
    return cloneState(saved as T);
  }

  clear(key: string): void {
    this.byKey.delete(key);
  }
}

export interface MobileListPersistenceHandle<T extends MobileListScrollState> {
  /**
   * Suscribe NavigationStart + destroy (keepScroll).
   * Pasá un getter del snapshot sin scrollY.
   */
  connect(getSnapshot: () => Omit<T, 'scrollY'>): void;
  /** Aplica el estado guardado; deja pendiente el scroll si había. */
  restore(apply: (state: T) => void): boolean;
  /** Guarda el estado actual (scroll real o el ya guardado si keepScroll). */
  persist(options?: { keepScroll?: boolean }): void;
  /** Restaura el scroll cuando la lista terminó de cargar. */
  onListReady(): void;
}

/**
 * Patrón completo de persistencia de listas mobile:
 * guardar en NavigationStart, no pisar scroll en destroy, restaurar al cargar.
 * Usar en el field initializer del componente (contexto de inyección).
 */
export function injectMobileListPersistence<T extends MobileListScrollState>(
  key: string,
): MobileListPersistenceHandle<T> {
  const stateService = inject(MobileListStateService);
  const breakpoint = inject(BreakpointService);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);

  let getSnapshot: (() => Omit<T, 'scrollY'>) | null = null;
  let pendingScrollY: number | null = null;
  let connected = false;

  const persist = (options: { keepScroll?: boolean } = {}): void => {
    if (!breakpoint.isMobile() || !getSnapshot) return;
    const scrollY = options.keepScroll
      ? (stateService.read<T>(key)?.scrollY ?? 0)
      : window.scrollY;
    stateService.save(key, { ...getSnapshot(), scrollY } as T);
  };

  return {
    connect(nextGetSnapshot) {
      getSnapshot = nextGetSnapshot;
      if (connected) return;
      connected = true;

      router.events
        .pipe(
          filter(
            (event): event is NavigationStart => event instanceof NavigationStart,
          ),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe(() => persist());

      destroyRef.onDestroy(() => {
        // Sin scroll: al destruirse la página ya está arriba y pisaría el
        // guardado en NavigationStart.
        persist({ keepScroll: true });
      });
    },

    restore(apply) {
      const saved = stateService.read<T>(key);
      if (!saved) return false;
      apply(saved);
      if (saved.scrollY > 0) {
        pendingScrollY = saved.scrollY;
      }
      return true;
    },

    persist,

    onListReady() {
      const y = pendingScrollY;
      if (y == null || y <= 0) return;
      pendingScrollY = null;
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    },
  };
}

function cloneState<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
