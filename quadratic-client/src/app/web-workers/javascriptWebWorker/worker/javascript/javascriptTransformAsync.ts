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
 * Find the index of the closing ')' that matches the '(' at openParenIndex.
 * Skips parentheses inside string literals (", ', and `) so nested calls work.
 */
function findMatchingCloseParen(code: string, openParenIndex: number): number {
  let depth = 1;
  let i = openParenIndex + 1;
  while (i < code.length && depth > 0) {
    const c = code[i];
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < code.length) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '`') {
      i++;
      while (i < code.length) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === '`') {
          i++;
          break;
        }
        if (code[i] === '$' && code[i + 1] === '{') {
          i += 2;
          let braceDepth = 1;
          while (i < code.length && braceDepth > 0) {
            const ch = code[i];
            if (ch === '\\') {
              i += 2;
              continue;
            }
            if (ch === '{') braceDepth++;
            else if (ch === '}') braceDepth--;
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    i++;
  }
  return depth === 0 ? i - 1 : -1;
}

/**
 * Transform q.cells(...) calls to (await q.cells(...)).
 * Uses balanced parenthesis matching so nested calls like q.cells(getRange("A1:B5")) work.
 */
export function addAwaitToCellCalls(code: string): string {
  const result: string[] = [];
  let lastEnd = 0;
  const re = /\bq\.cells\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingCloseParen(code, openParenIndex);
    if (closeParenIndex === -1) continue;
    result.push(code.slice(lastEnd, match.index));
    const args = code.slice(openParenIndex + 1, closeParenIndex);
    result.push(`(await q.cells(${args}))`);
    lastEnd = closeParenIndex + 1;
  }
  result.push(code.slice(lastEnd));
  return result.join('');
}
