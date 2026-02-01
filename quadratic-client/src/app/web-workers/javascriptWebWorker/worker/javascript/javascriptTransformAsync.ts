/**
 * Code transformation for async cell access when SharedArrayBuffer is unavailable.
 *
 * When SAB is not available, q.cells() returns a Promise instead of blocking
 * with Atomics.wait(). This module transforms user code to add `await` before
 * q.cells() calls so they work correctly.
 *
 * The transformation wraps calls in parentheses to handle edge cases like:
 * - `return q.cells('A1')` becomes `return (await q.cells('A1'))`
 * - `const x = q.cells('A1')` becomes `const x = (await q.cells('A1'))`
 */

/**
 * Transform q.cells(...) calls to (await q.cells(...))
 *
 * Note: This regex handles simple cases. For nested parentheses like
 * q.cells(getRange()), more sophisticated parsing may be needed.
 */
export function addAwaitToCellCalls(code: string): string {
  // Match q.cells followed by parentheses with content
  // The regex captures the arguments to preserve them
  // Wrapping in parentheses ensures correct precedence for return statements
  return code.replace(/\bq\.cells\s*\(([^)]*)\)/g, '(await q.cells($1))');
}
