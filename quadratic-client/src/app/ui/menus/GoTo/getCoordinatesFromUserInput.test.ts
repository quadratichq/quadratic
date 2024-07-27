import { describe, expect, test } from 'vitest';

import { getCoordinatesFromUserInput } from '@/app/ui/menus/GoTo/getCoordinatesFromUserInput';

const fn = getCoordinatesFromUserInput;

describe('getCoordinatesFromUserInput()', () => {
  test('GoTo cell: expected input returns expected coordinates', () => {
    expect(fn('0 0')).toStrictEqual([{ x: 0, y: 0 }]);

    expect(fn('1 1')).toStrictEqual([{ x: 1, y: 1 }]);
    expect(fn('-1 1')).toStrictEqual([{ x: -1, y: 1 }]);
    expect(fn('1 -1')).toStrictEqual([{ x: 1, y: -1 }]);
    expect(fn('-1 -1')).toStrictEqual([{ x: -1, y: -1 }]);

    expect(fn('1, 1')).toStrictEqual([{ x: 1, y: 1 }]);
    expect(fn('-1, 1')).toStrictEqual([{ x: -1, y: 1 }]);
    expect(fn('1, -1')).toStrictEqual([{ x: 1, y: -1 }]);
    expect(fn('-1, -1')).toStrictEqual([{ x: -1, y: -1 }]);

    expect(fn('(1 1)')).toStrictEqual([{ x: 1, y: 1 }]);
    expect(fn('(-1 1)')).toStrictEqual([{ x: -1, y: 1 }]);
    expect(fn('(1 -1)')).toStrictEqual([{ x: 1, y: -1 }]);
    expect(fn('(-1 -1)')).toStrictEqual([{ x: -1, y: -1 }]);

    expect(fn('(1, 1)')).toStrictEqual([{ x: 1, y: 1 }]);
    expect(fn('(-1, 1)')).toStrictEqual([{ x: -1, y: 1 }]);
    expect(fn('(1, -1)')).toStrictEqual([{ x: 1, y: -1 }]);
    expect(fn('(-1, -1)')).toStrictEqual([{ x: -1, y: -1 }]);
  });

  test('GoTo cell: one sequence of digit(s) returns x coordinate and y default', () => {
    expect(fn('0')).toStrictEqual([{ x: 0, y: 0 }]);

    expect(fn('1')).toStrictEqual([{ x: 1, y: 0 }]);
    expect(fn('abc1')).toStrictEqual([{ x: 1, y: 0 }]);
    expect(fn('abc 1')).toStrictEqual([{ x: 1, y: 0 }]);
    expect(fn('abc 1 bduej')).toStrictEqual([{ x: 1, y: 0 }]);

    expect(fn('-1')).toStrictEqual([{ x: -1, y: 0 }]);
    expect(fn('***-1')).toStrictEqual([{ x: -1, y: 0 }]);
    expect(fn('  -1 fde fas ***')).toStrictEqual([{ x: -1, y: 0 }]);

    expect(fn('256')).toStrictEqual([{ x: 256, y: 0 }]);
    expect(fn('abc256')).toStrictEqual([{ x: 256, y: 0 }]);
    expect(fn('abc256bd*()$')).toStrictEqual([{ x: 256, y: 0 }]);
    expect(fn('*()%as 256ab-b')).toStrictEqual([{ x: 256, y: 0 }]);
    expect(fn('-----256-----')).toStrictEqual([{ x: -256, y: 0 }]);
    expect(fn('--b256bc')).toStrictEqual([{ x: 256, y: 0 }]);
  });

  test('GoTo cell: two sequences of digit(s) returns x and y coordinates', () => {
    expect(fn('0 0')).toStrictEqual([{ x: 0, y: 0 }]);
    expect(fn('1 1')).toStrictEqual([{ x: 1, y: 1 }]);
    expect(fn('256 -9')).toStrictEqual([{ x: 256, y: -9 }]);
    expect(fn('abc 256, abd-9fea')).toStrictEqual([{ x: 256, y: -9 }]);
  });

  test('GoTo cell: input without digits returns default coordinates', () => {
    const defaultCoors = [{ x: 0, y: 0 }];
    expect(fn('abc')).toStrictEqual(defaultCoors);
    expect(fn('----')).toStrictEqual(defaultCoors);
    expect(fn('(*)*&fhauifheu#, df')).toStrictEqual(defaultCoors);
    expect(fn('----abbde---dfa -a -+')).toStrictEqual(defaultCoors);
  });

  test('GoTo cell: zero padded strings return integers', () => {
    expect(fn('00001 000005')).toStrictEqual([{ x: 1, y: 5 }]);
  });

  test('GoTo range: three sequences of digit(s) returns two sets of x/y coordinates, with the last y coordinate defaulting to the first y coordinate’s value', () => {
    expect(fn('0 0 1')).toStrictEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(fn('0 0 1')).toStrictEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(fn('254 2 -1')).toStrictEqual([
      { x: 254, y: 2 },
      { x: -1, y: 2 },
    ]);
    expect(fn('abc 50 -1 asdf eil fkd4jdielad de***')).toStrictEqual([
      { x: 50, y: -1 },
      { x: 4, y: -1 },
    ]);
    expect(fn('-1---3-asef091')).toStrictEqual([
      { x: -1, y: -3 },
      { x: 91, y: -3 },
    ]);
  });

  test('GoTo range: three or four sequences of digit(s) that are identical return a single x/y coordinate', () => {
    expect(fn('0 0 0')).toStrictEqual([{ x: 0, y: 0 }]);
    expect(fn('0 0 0 0')).toStrictEqual([{ x: 0, y: 0 }]);
  });

  test('GoTo range: four or more sequences of digit(s) returns two sets of x/y coordinates', () => {
    expect(fn('0 0 1 1')).toStrictEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(fn('-1 100 225 123')).toStrictEqual([
      { x: -1, y: 100 },
      { x: 225, y: 123 },
    ]);
    expect(fn('-1 100 225 123 51')).toStrictEqual([
      { x: -1, y: 100 },
      { x: 225, y: 123 },
    ]);
  });
});
