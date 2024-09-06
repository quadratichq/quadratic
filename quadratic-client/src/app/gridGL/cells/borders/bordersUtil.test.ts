import { describe, expect, it } from 'vitest';
import { divideLine, findPerpendicularHorizontalLines, findPerpendicularVerticalLines } from './bordersUtil';
import { BorderStyleCell } from '@/app/quadratic-core-types';

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

describe('should find perpendicular lines', () => {
  const color = { red: 0, green: 0, blue: 0, alpha: 0 };

  it('finds horizontal lines at start', () => {
    const entries: Record<string, BorderStyleCell> = {
      '1': {
        top: { timestamp: 1, color, line: 'line1' },
        bottom: null,
        left: null,
        right: null,
      },
    };
    const lines = findPerpendicularHorizontalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(1n);
    expect(line1.y).toEqual(0n);
    expect(line1.width).toEqual(1n);
  });

  it('finds horizontal lines at the start (but timestamp is too old)', () => {
    const entries: Record<string, BorderStyleCell> = {
      '1': {
        top: { timestamp: 1, color, line: 'line1' },
        bottom: null,
        left: null,
        right: null,
      },
    };
    const lines = findPerpendicularHorizontalLines(1, 3, 2, entries);
    expect(lines).toEqual([]);
  });

  it('finds horizontal lines in the start (but bottom)', () => {
    const entries: Record<string, BorderStyleCell> = {
      '0': {
        top: null,
        bottom: { timestamp: 1, color, line: 'line1' },
        left: null,
        right: null,
      },
    };
    const lines = findPerpendicularHorizontalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(1n);
    expect(line1.y).toEqual(0n);
    expect(line1.width).toEqual(1n);
  });

  it('finds horizontal lines in the middle', () => {
    const entries: Record<string, BorderStyleCell> = {
      '2': {
        top: { timestamp: 1, color, line: 'line1' },
        bottom: null,
        left: null,
        right: null,
      },
    };
    const lines = findPerpendicularHorizontalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(2n);
    expect(line1.y).toEqual(0n);
    expect(line1.width).toEqual(1n);
  });

  it('finds horizontal lines in the middle (but bottom)', () => {
    const entries: Record<string, BorderStyleCell> = {
      '1': {
        top: null,
        bottom: { timestamp: 1, color, line: 'line1' },
        left: null,
        right: null,
      },
    };
    const lines = findPerpendicularHorizontalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(2n);
    expect(line1.y).toEqual(0n);
    expect(line1.width).toEqual(1n);
  });

  it('finds horizontal lines in the end', () => {
    const entries: Record<string, BorderStyleCell> = {
      '2': {
        top: { timestamp: 1, color, line: 'line1' },
        bottom: null,
        left: null,
        right: null,
      },
    };
    const lines = findPerpendicularHorizontalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(2n);
    expect(line1.y).toEqual(0n);
    expect(line1.width).toEqual(1n);
  });

  it('finds horizontal lines in the end (but bottom)', () => {
    const entries: Record<string, BorderStyleCell> = {
      '1': {
        top: null,
        bottom: { timestamp: 1, color, line: 'line1' },
        left: null,
        right: null,
      },
    };
    const lines = findPerpendicularHorizontalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(2n);
    expect(line1.y).toEqual(0n);
    expect(line1.width).toEqual(1n);
  });
});

describe('should find perpendicular vertical lines', () => {
  const color = { red: 0, green: 0, blue: 0, alpha: 0 };

  it('finds vertical lines in the middle', () => {
    const entries: Record<string, BorderStyleCell> = {
      '2': {
        top: null,
        bottom: null,
        left: { timestamp: 1, color, line: 'line1' },
        right: null,
      },
    };
    const lines = findPerpendicularVerticalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(0n);
    expect(line1.y).toEqual(2n);
    expect(line1.height).toEqual(1n);
  });

  it('finds vertical lines at the start', () => {
    const entries: Record<string, BorderStyleCell> = {
      '1': {
        top: null,
        bottom: null,
        left: { timestamp: 1, color, line: 'line1' },
        right: null,
      },
    };
    const lines = findPerpendicularVerticalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(0n);
    expect(line1.y).toEqual(1n);
    expect(line1.height).toEqual(1n);
  });

  it('finds vertical lines at the end', () => {
    const entries: Record<string, BorderStyleCell> = {
      '3': {
        top: null,
        bottom: null,
        left: { timestamp: 1, color, line: 'line1' },
        right: null,
      },
    };
    const lines = findPerpendicularVerticalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(0n);
    expect(line1.y).toEqual(3n);
    expect(line1.height).toEqual(1n);
  });

  it('finds vertical lines using right property', () => {
    const entries: Record<string, BorderStyleCell> = {
      '1': {
        top: null,
        bottom: null,
        left: null,
        right: { timestamp: 1, color, line: 'line1' },
      },
    };
    const lines = findPerpendicularVerticalLines(1, 3, 0, entries);
    expect(lines.length).toEqual(1);
    const line1 = lines[0];
    expect(line1.x).toEqual(0n);
    expect(line1.y).toEqual(2n);
    expect(line1.height).toEqual(1n);
  });

  it('does not find lines with older timestamp', () => {
    const entries: Record<string, BorderStyleCell> = {
      '2': {
        top: null,
        bottom: null,
        left: { timestamp: 0, color, line: 'line1' },
        right: null,
      },
    };
    const lines = findPerpendicularVerticalLines(1, 3, 1, entries);
    expect(lines.length).toEqual(0);
  });
});
