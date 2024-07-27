import { expect, test } from 'vitest';

import { adjustPercentages } from '@/app/ui/menus/CodeEditor/panels/adjustPercentages';

test('adjustPercentages', () => {
  // 2 heights
  let percentages = [50, 50];
  const setPercentages = (newPercentages: number[]) => {
    percentages = newPercentages;
  };
  adjustPercentages(percentages, setPercentages as any, 1, 60);
  expect(percentages).toEqual([40, 60]);

  percentages = [50, 50];
  adjustPercentages(percentages, setPercentages as any, 0, 60);
  expect(percentages).toEqual([60, 40]);

  // 3 heights
  percentages = [34, 33, 33];
  adjustPercentages(percentages, setPercentages as any, 0, 20);
  expect(percentages).toEqual([20, 47, 33]);

  percentages = [34, 33, 33];
  adjustPercentages(percentages, setPercentages as any, 1, 20);
  expect(percentages).toEqual([34, 20, 46]);

  percentages = [34, 33, 33];
  adjustPercentages(percentages, setPercentages as any, 2, 50);
  expect(percentages).toEqual([30, 20, 50]);

  percentages = [34, 33, 33];
  adjustPercentages(percentages, setPercentages as any, 1, 70);
  expect(percentages).toEqual([20, 47, 33]);

  percentages = [34, 33, 33];
  adjustPercentages(percentages, setPercentages as any, 2, 20);
  expect(percentages).toEqual([34, 46, 20]);
});
