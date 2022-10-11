/**
 * Quick array comparison
 * NOTE: if a and b are both undefined then returns true
 * @param a
 * @param b
 * @returns
 */
export function isArrayShallowEqual(a?: any[], b?: any[]): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
