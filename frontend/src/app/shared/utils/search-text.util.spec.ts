import {
  compareSearchText,
  matchesSearchText,
  normalizeSearchText,
  sortAndDisambiguateOptions,
} from './search-text.util';

describe('search-text.util', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normalizeSearchText('  ÁRBOL ')).toBe('arbol');
    expect(matchesSearchText('QA-3mf Base árbol', 'ARBOL')).toBe(true);
    expect(matchesSearchText('Arbol de equilibrio', 'ÁRBOL')).toBe(true);
    expect(matchesSearchText('Taza', 'vaso')).toBe(false);
    expect(matchesSearchText('Taza', '')).toBe(true);
  });

  it('ordena sin distinguir tildes', () => {
    expect(['b', 'Álamo', 'a'].sort(compareSearchText)).toEqual(['a', 'Álamo', 'b']);
  });

  it('distingue duplicados idénticos', () => {
    const out = sortAndDisambiguateOptions(
      [
        { value: '1', label: 'Taza', cat: 'FDM' },
        { value: '2', label: 'Taza', cat: 'Resina' },
        { value: '3', label: 'Alfa', cat: 'FDM' },
      ],
      (o) => o.cat,
    );
    expect(out.map((o) => o.label)).toEqual(['Alfa', 'Taza (FDM)', 'Taza (Resina)']);
  });
});
