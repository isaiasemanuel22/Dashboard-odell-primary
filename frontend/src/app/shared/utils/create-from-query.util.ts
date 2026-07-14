import { ActivatedRoute, Router } from '@angular/router';

export function shouldOpenCreateFromQuery(route: ActivatedRoute): boolean {
  const value = route.snapshot.queryParamMap.get('nuevo');
  return value === '1' || value === 'true';
}

export function clearCreateQuery(router: Router): void {
  if (!router.url.includes('nuevo=')) return;

  void router.navigate([], {
    queryParams: { nuevo: null },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
