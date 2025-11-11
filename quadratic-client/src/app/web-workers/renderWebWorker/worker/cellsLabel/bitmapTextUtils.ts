/**
 * Polyfill for IE because it doesn't support `codePointAt`
 * @param str
 * @private
 */
export function extractCharCode(str: string): number {
  return (str.codePointAt ? str.codePointAt(0) : str.charCodeAt(0)) ?? 0;
}

export function splitTextToCharacters(text: string): string[] {
  // Use the Intl.Segmenter API if available (best for emoji)
  // Falls back to Array.from which handles most emoji reasonably well
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (segment: any) => segment.segment);
  }
  return Array.from ? Array.from(text) : text.split('');
}
