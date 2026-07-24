/** Resuelve URLs de medios utilizables por el navegador. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  return null;
}

/** Filtra URLs legacy (/uploads, rutas relativas) al editar productos. */
export function sanitizePersistableProductImages(
  urls: string[] | null | undefined,
): { images: string[]; removedCount: number } {
  const source = urls ?? [];
  const images = source.filter((url) => /^https:\/\//i.test(url.trim()));
  return { images, removedCount: source.length - images.length };
}

export function resolveMediaUrls(urls: string[] | null | undefined): string[] {
  if (!urls?.length) return [];
  return urls
    .map((url) => resolveMediaUrl(url))
    .filter((url): url is string => !!url);
}
