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

export function plainTextFromHtml(html: string | null | undefined): string {
  if (!html?.trim()) return '';
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function hasRichTextContent(html: string | null | undefined): boolean {
  const sanitized = sanitizeRichTextHtml(html);
  if (!sanitized) return false;
  if (plainTextFromHtml(sanitized).length > 0) return true;
  return /<img\b/i.test(sanitized);
}

export function excerptPlainText(
  html: string | null | undefined,
  maxLength = 120,
): string {
  const text = plainTextFromHtml(html);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

/** Compara HTML de Quill ignorando solo diferencias nbsp ↔ espacio (no mueve el cursor). */
export function richTextEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const norm = (html: string | null | undefined): string =>
    (html ?? '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\u00a0/g, ' ')
      .trim();
  return norm(a) === norm(b);
}

export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html?.trim()) return '';

  // Quill inserta &nbsp; / U+00A0; al guardar quedan espacios normales.
  const normalized = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (typeof document === 'undefined') {
    return normalized;
  }

  const template = document.createElement('template');
  template.innerHTML = normalized;
  sanitizeNode(template.content);
  normalizeNbspInTree(template.content);
  return template.innerHTML.trim();
}

function normalizeNbspInTree(node: ParentNode): void {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeValue?.includes('\u00a0')) {
      current.nodeValue = current.nodeValue.replace(/\u00a0/g, ' ');
    }
    current = walker.nextNode();
  }
}

function sanitizeNode(node: ParentNode): void {
  const children = Array.from(node.childNodes);

  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }

    const element = child as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      unwrapElement(element);
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (tag === 'a' && name === 'href') {
        if (!/^https?:\/\//i.test(attr.value) && !/^mailto:/i.test(attr.value)) {
          element.removeAttribute(attr.name);
        }
        continue;
      }

      if (tag === 'img' && (name === 'src' || name === 'alt' || name === 'title')) {
        if (name === 'src' && !/^(https?:\/\/|\/|data:image\/)/i.test(attr.value)) {
          element.removeAttribute(attr.name);
        }
        continue;
      }

      element.removeAttribute(attr.name);
    }

    sanitizeNode(element);
  }
}

function unwrapElement(element: HTMLElement): void {
  const parent = element.parentNode;
  if (!parent) {
    element.remove();
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}
