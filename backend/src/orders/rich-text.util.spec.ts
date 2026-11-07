import { sanitizeRichTextHtml } from './rich-text.util';

describe('sanitizeRichTextHtml', () => {
  const firebaseSrc =
    'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&amp;token=abc';

  it('keeps a single &amp; in Firebase img src (no double-escape)', () => {
    const input = `<p><img src="${firebaseSrc}"></p>`;
    const out = sanitizeRichTextHtml(input);
    expect(out).toContain(
      'src="https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&amp;token=abc"',
    );
    expect(out).not.toContain('&amp;amp;');
  });

  it('is idempotent: sanitizing twice equals sanitizing once', () => {
    const input = `<p><img src="${firebaseSrc}" alt="foto &quot;demo&quot;"></p>`;
    const once = sanitizeRichTextHtml(input);
    const twice = sanitizeRichTextHtml(once);
    expect(twice).toBe(once);
  });

  it('repairs already double-escaped &amp;amp;token in src', () => {
    const damaged =
      'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&amp;amp;token=abc';
    const input = `<p><img src="${damaged}"></p>`;
    const out = sanitizeRichTextHtml(input);
    expect(out).toContain(
      'src="https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&amp;token=abc"',
    );
    expect(out).not.toContain('&amp;amp;');
  });

  it('blocks javascript: src even when written with HTML entities', () => {
    const withColonEntity = `<p><img src="javascript&#58;alert(1)"></p>`;
    const withSchemeEntities = `<p><img src="&#106;avascript:alert(1)"></p>`;
    const hrefWithColonEntity = `<p><a href="javascript&#58;alert(1)">x</a></p>`;

    expect(sanitizeRichTextHtml(withColonEntity)).not.toContain('src=');
    expect(sanitizeRichTextHtml(withSchemeEntities)).not.toContain('src=');
    expect(sanitizeRichTextHtml(hrefWithColonEntity)).not.toContain('href=');
  });

  it('does not throw on out-of-range numeric entities', () => {
    expect(() =>
      sanitizeRichTextHtml(
        '<p><img src="https://example.com/a.png?x=&#99999999;&#xFFFFFFFF;"></p>',
      ),
    ).not.toThrow();
  });
});
