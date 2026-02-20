import { describe, expect, it } from 'vitest';
import { addAwaitToCellCalls } from './javascriptTransformAsync';

describe('addAwaitToCellCalls', () => {
  it('wraps simple q.cells(string) in await', () => {
    expect(addAwaitToCellCalls("q.cells('A1')")).toBe("(await q.cells('A1'))");
    expect(addAwaitToCellCalls('q.cells("A1")')).toBe('(await q.cells("A1"))');
    expect(addAwaitToCellCalls('q.cells("A1:B5")')).toBe('(await q.cells("A1:B5"))');
  });

  it('handles return statements', () => {
    expect(addAwaitToCellCalls('return q.cells("A1")')).toBe('return (await q.cells("A1"))');
  });

  it('handles assignments', () => {
    expect(addAwaitToCellCalls('const x = q.cells("A1")')).toBe('const x = (await q.cells("A1"))');
  });

  it('handles nested parentheses (e.g. getRange)', () => {
    expect(addAwaitToCellCalls('q.cells(getRange("A1:B5"))')).toBe('(await q.cells(getRange("A1:B5")))');
    expect(addAwaitToCellCalls('return q.cells(getRange("A1"))')).toBe('return (await q.cells(getRange("A1")))');
  });

  it('handles multiple q.cells calls', () => {
    expect(addAwaitToCellCalls('q.cells("A1"); q.cells("B2")')).toBe('(await q.cells("A1")); (await q.cells("B2"))');
  });

  it('leaves code without q.cells unchanged', () => {
    const code = 'const x = 1; console.log("hello");';
    expect(addAwaitToCellCalls(code)).toBe(code);
  });

  it('does not match q.cells in the middle of a longer identifier', () => {
    expect(addAwaitToCellCalls('my_q.cells("A1")')).toBe('my_q.cells("A1")');
  });

  it('handles single quotes inside double-quoted argument', () => {
    expect(addAwaitToCellCalls('q.cells("A1:B5")')).toBe('(await q.cells("A1:B5"))');
  });

  it('handles double quotes inside single-quoted argument', () => {
    expect(addAwaitToCellCalls("q.cells('A1:B5')")).toBe("(await q.cells('A1:B5'))");
  });

  it('handles template literal argument', () => {
    expect(addAwaitToCellCalls('q.cells(`A1:B5`)')).toBe('(await q.cells(`A1:B5`))');
  });

  it('handles deeply nested parentheses', () => {
    expect(addAwaitToCellCalls('q.cells(foo(bar("x")))')).toBe('(await q.cells(foo(bar("x"))))');
  });
});
