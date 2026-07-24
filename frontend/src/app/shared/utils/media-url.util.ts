import { environment } from '../../../environments/environment';

/** Origen del API cuando apiUrl es absoluta (p. ej. Heroku en producción). */
function apiOrigin(): string | null {
  const apiUrl = environment.apiUrl?.trim();
  if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) return null;
  return apiUrl.replace(/\/api\/?$/, '');
}

/** Convierte rutas relativas de uploads en URLs utilizables por el navegador. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;

  const normalized = url.startsWith('/')
    ? url
    : `/${url.replace(/^\/+/, '')}`;

  if (normalized.startsWith('/uploads/')) {
    if (environment.production) return null;
    const origin = apiOrigin();
    if (origin) return `${origin}${normalized}`;
  }

  return normalized;
}

/** Filtra URLs legacy (/uploads) al editar en producción. */
export function sanitizePersistableProductImages(
  urls: string[] | null | undefined,
): { images: string[]; removedCount: number } {
  const source = urls ?? [];
  if (!environment.production) {
    return { images: [...source], removedCount: 0 };
  }
  const images = source.filter((url) => /^https:\/\//i.test(url.trim()));
  return { images, removedCount: source.length - images.length };
}

export function resolveMediaUrls(urls: string[] | null | undefined): string[] {
  if (!urls?.length) return [];
  return urls
    .map((url) => resolveMediaUrl(url))
    .filter((url): url is string => !!url);
}
