/** Convierte rutas relativas de uploads en URLs utilizables por el navegador. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  if (url.startsWith('/')) return url;
  return `/${url.replace(/^\/+/, '')}`;

}

export function resolveMediaUrls(urls: string[] | null | undefined): string[] {
  if (!urls?.length) return [];
  return urls
    .map((url) => resolveMediaUrl(url))
    .filter((url): url is string => !!url);
}
