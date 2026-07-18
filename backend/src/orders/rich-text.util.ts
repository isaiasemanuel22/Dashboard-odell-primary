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

export const ORDER_RICH_TEXT_MAX_LENGTH = 20_000;

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

  let output = html.trim();
  output = output.replace(/<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  output = output.replace(/<\s*(script|style|iframe)[^>]*\/?>/gi, '');

  output = output.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagRaw, attrsRaw) => {
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
  });

  return output.trim();
}

function sanitizeAttributes(tag: string, attrsRaw: string): string {
  const attrs: string[] = [];
  const attrPattern = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(attrsRaw)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';

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

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
