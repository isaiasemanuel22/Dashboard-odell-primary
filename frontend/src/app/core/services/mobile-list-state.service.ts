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
  let cancelRestore: (() => void) | null = null;

  destroyRef.onDestroy(() => {
    cancelRestore?.();
    cancelRestore = null;
  });

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
      // Releer el guardado: Productos llama otra vez cuando llegan banners
      // después del catálogo, y el primer ciclo ya pudo “terminar”.
      const y =
        pendingScrollY ?? stateService.read<T>(key)?.scrollY ?? null;
      if (y == null || y <= 0) return;
      pendingScrollY = y;
      cancelRestore?.();
      cancelRestore = restoreScrollWhenTallEnough(y, (reason) => {
        cancelRestore = null;
        if (reason === 'user') {
          pendingScrollY = null;
        }
      });
    },
  };
}

/**
 * Restaura scrollY reintentando por frame hasta que la página sea lo bastante
 * alta (lista ya con datos) o pasen ~2 s. Después, si la altura del documento
 * sigue cambiando (~1,5 s: banners, imágenes), reaplica la posición mientras
 * el usuario no haya scrolleado.
 */
function restoreScrollWhenTallEnough(
  targetY: number,
  onDone?: (reason: 'done' | 'user') => void,
): () => void {
  const maxMs = 2000;
  const settleWatchMs = 1500;
  const settleMs = 120;
  const start = performance.now();
  let cancelled = false;
  let ignoreUntil = 0;
  let rafId = 0;
  let watchId = 0;
  let lastHeight = 0;
  let reachedAt: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let finishReason: 'done' | 'user' = 'done';

  const cleanup = (): void => {
    window.removeEventListener('scroll', onUserScroll);
    if (rafId) cancelAnimationFrame(rafId);
    if (watchId) window.clearTimeout(watchId);
    rafId = 0;
    watchId = 0;
    resizeObserver?.disconnect();
    resizeObserver = null;
  };

  const finish = (): void => {
    cleanup();
    onDone?.(finishReason);
  };

  const onUserScroll = (): void => {
    if (cancelled) return;
    if (performance.now() < ignoreUntil) return;
    cancelled = true;
    finishReason = 'user';
    finish();
  };

  const applyScroll = (): void => {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    ignoreUntil = performance.now() + settleMs;
    window.scrollTo(0, Math.min(targetY, maxScroll));
    lastHeight = document.documentElement.scrollHeight;
  };

  const startHeightWatch = (): void => {
    reachedAt = performance.now();
    const reapplyIfGrown = (): void => {
      if (cancelled || reachedAt == null) return;
      if (performance.now() - reachedAt >= settleWatchMs) {
        finish();
        return;
      }
      const height = document.documentElement.scrollHeight;
      if (height !== lastHeight) {
        applyScroll();
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => reapplyIfGrown());
      resizeObserver.observe(document.documentElement);
      resizeObserver.observe(document.body);
    }

    const poll = (): void => {
      if (cancelled || reachedAt == null) return;
      reapplyIfGrown();
      if (cancelled || reachedAt == null) return;
      if (performance.now() - reachedAt >= settleWatchMs) {
        finish();
        return;
      }
      watchId = window.setTimeout(poll, 100);
    };
    watchId = window.setTimeout(poll, 100);
  };

  window.addEventListener('scroll', onUserScroll, { passive: true });

  const tick = (): void => {
    if (cancelled) return;

    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const elapsed = performance.now() - start;
    const canReach = maxScroll >= targetY - 1;
    const timedOut = elapsed >= maxMs;

    applyScroll();

    if (canReach || timedOut) {
      // Un frame más por si el chip-row u otra pintura mueven el scroll.
      rafId = requestAnimationFrame(() => {
        if (cancelled) return;
        applyScroll();
        startHeightWatch();
      });
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cleanup();
  };
}

function cloneState<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
