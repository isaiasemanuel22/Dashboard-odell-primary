const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'img',
]);

/** Límite de negocio: caracteres de texto plano (sin tags). */
export const ORDER_RICH_TEXT_MAX_LENGTH = 1_000;
/** Tope del HTML crudo en DTO (tags + texto); el límite real se valida en texto plano. */
export const ORDER_RICH_TEXT_HTML_MAX_LENGTH = 5_000;

export function plainTextFromHtml(html: string | null | undefined): string {
  if (!html?.trim()) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasRichTextContent(html: string | null | undefined): boolean {
  const sanitized = sanitizeRichTextHtml(html);
  if (!sanitized) return false;
  if (plainTextFromHtml(sanitized).length > 0) return true;
  return /<img\b/i.test(sanitized);
}

export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html?.trim()) return '';

  let output = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
  output = output.replace(
    /<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    '',
  );
  output = output.replace(/<\s*(script|style|iframe)[^>]*\/?>/gi, '');

  output = output.replace(
    /<\/?([a-z0-9]+)([^>]*)>/gi,
    (match, tagRaw, attrsRaw) => {
      const tag = String(tagRaw).toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        return '';
      }

      if (tag === 'br') {
        return '<br>';
      }

      const attrs = sanitizeAttributes(tag, String(attrsRaw ?? ''));
      if (match.startsWith('</')) {
        return `</${tag}>`;
      }

      return attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
    },
  );

  return output.trim();
}

function sanitizeAttributes(tag: string, attrsRaw: string): string {
  const attrs: string[] = [];
  const attrPattern = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(attrsRaw)) !== null) {
    const name = match[1].toLowerCase();
    const rawValue = match[3] ?? match[4] ?? match[5] ?? '';
    // Decode first so scheme checks see the real URL and re-escape stays idempotent.
    const value = decodeHtmlEntities(rawValue);

    if (tag === 'a' && name === 'href') {
      if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) {
        attrs.push(`href="${escapeAttribute(value)}"`);
      }
      continue;
    }

    if (tag === 'img') {
      if (name === 'src' && /^(https?:\/\/|\/|data:image\/)/i.test(value)) {
        attrs.push(`src="${escapeAttribute(value)}"`);
      }
      if (name === 'alt' || name === 'title') {
        attrs.push(`${name}="${escapeAttribute(value)}"`);
      }
    }
  }

  return attrs.join(' ');
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
};

/** Decodes &amp; &quot; &#39; &lt; &gt; and numeric entities; repeats to repair &amp;amp;. */
function decodeHtmlEntities(value: string): string {
  let current = value;
  const maxIterations = 8;

  for (let i = 0; i < maxIterations; i++) {
    const next = current.replace(
      /&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));/g,
      (full, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
        if (hex !== undefined) {
          const code = Number.parseInt(hex, 16);
          return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
            ? String.fromCodePoint(code)
            : full;
        }
        if (dec !== undefined) {
          const code = Number.parseInt(dec, 10);
          return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
            ? String.fromCodePoint(code)
            : full;
        }
        if (name !== undefined) {
          const mapped = NAMED_HTML_ENTITIES[name.toLowerCase()];
          return mapped !== undefined ? mapped : full;
        }
        return full;
      },
    );
    if (next === current) break;
    current = next;
  }

  return current;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
