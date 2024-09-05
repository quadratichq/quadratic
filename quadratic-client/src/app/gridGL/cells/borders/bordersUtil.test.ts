import { describe, expect, it } from 'vitest';
import { divideLine } from './bordersUtil';

describe('should divide line', () => {
  it('breaks in the middle', () => {
    const line = [1, 30];
    const breaks = [
      [2, 3],
      [10, 5],
    ];
    const lines: [number, number][] = [];
    let current = undefined;

    for (const b of breaks) {
      current = divideLine(lines, current, line[0], line[1], b[0], b[1]);
    }
    if (current && current <= line[1]) {
      lines.push([current, line[1] + 1]);
    }

    expect(lines).toEqual([
      [1, 2],
      [5, 10],
      [15, 31],
    ]);
  });

  it('breaks at the start', () => {
    const line = [1, 30];
    const breaks = [
      [1, 3],
      [10, 5],
    ];
    const lines: [number, number][] = [];
    let current = undefined;

    for (const b of breaks) {
      current = divideLine(lines, current, line[0], line[1], b[0], b[1]);
    }
    if (current && current <= line[1]) {
      lines.push([current, line[1] + 1]);
    }

    expect(lines).toEqual([
      [4, 10],
      [15, 31],
    ]);
  });

  it('breaks at the end', () => {
    const line = [1, 30];
    const breaks = [
      [20, 3],
      [25, 40],
    ];
    const lines: [number, number][] = [];
    let current = undefined;

    for (const b of breaks) {
      current = divideLine(lines, current, line[0], line[1], b[0], b[1]);
    }
    if (current && current <= line[1]) {
      lines.push([current, line[1] + 1]);
    }

    expect(lines).toEqual([
      [1, 20],
      [23, 25],
    ]);
  });
});
