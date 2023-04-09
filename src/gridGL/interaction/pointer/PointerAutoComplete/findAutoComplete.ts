import { Cell } from '../../../../schemas';
import { isStringANumber } from '../../../helpers/isStringANumber';
import { getSeriesNextKey, isSeriesKey, isSeriesNextKey, textSeries } from './textSeries';

interface Series {
  series: (Cell | undefined)[];
  spaces: number;
  negative: boolean;
}

function copySeries(options: Series): (Cell | undefined)[] {
  const { series, spaces } = options;
  const results: (Cell | undefined)[] = [];
  let copy = 0;
  for (let i = 0; i < spaces; i++) {
    results.push(series[copy]);
    copy = (copy + 1) % series.length;
  }
  return results;
}

function findNumberSeries(options: Series): (Cell | undefined)[] {
  const { series, spaces, negative } = options;

  // if only one number, copy it
  if (series.length === 1) {
    return copySeries(options);
  }

  const numbers = series.map((s) => Number((s as Cell).value));

  let addition: boolean | number = true;
  let multiplication: boolean | number = true;

  for (let i = 1; i < numbers.length; i++) {
    const difference = numbers[i] - numbers[i - 1];
    if (addition !== false) {
      if (addition === true) {
        addition = difference;
      } else if (difference !== addition) {
        addition = false;
      }
    }

    // no divide by zero
    if (numbers[i - 1] === 0) {
      multiplication = false;
    } else {
      const quotient = numbers[i] / numbers[i - 1];
      if (multiplication !== false) {
        if (multiplication === true) {
          multiplication = quotient;
        } else if (quotient !== multiplication) {
          multiplication = false;
        }
      }
    }
  }

  if (addition !== false) {
    const results: Cell[] = [];
    if (negative) {
      let current = numbers[0];
      for (let i = 0; i < spaces; i++) {
        current = current - (addition as number);
        results.push({ value: current.toString(), type: 'TEXT' } as Cell);
      }
      results.reverse();
    } else {
      let current = numbers[numbers.length - 1];
      for (let i = 0; i < spaces; i++) {
        current = current + (addition as number);
        results.push({ value: current.toString(), type: 'TEXT' } as Cell);
      }
    }
    return results;
  }

  if (multiplication !== false) {
    const results: Cell[] = [];
    if (negative) {
      let current = numbers[0];
      for (let i = 0; i < spaces; i++) {
        current = current / (multiplication as number);
        results.push({ value: current.toString(), type: 'TEXT' } as Cell);
      }
      results.reverse();
    } else {
      let current = numbers[numbers.length - 1];
      for (let i = 0; i < spaces; i++) {
        current = current * (multiplication as number);
        results.push({ value: current.toString(), type: 'TEXT' } as Cell);
      }
    }
    return results;
  }

  // no series found
  return copySeries(options);
}

function findStringSeries(options: Series): (Cell | undefined)[] {
  const { series, spaces, negative } = options;

  const possibleTextSeries: (boolean | string[])[] = textSeries.map(() => true);

  for (const cell of series) {
    const s = (cell as Cell).value;
    for (let i = 0; i < textSeries.length; i++) {
      const entry = possibleTextSeries[i];
      if (possibleTextSeries[i] !== false) {
        if (!isSeriesKey(s, textSeries[i])) {
          possibleTextSeries[i] = false;
        } else if (entry === true) {
          possibleTextSeries[i] = [s];
        } else if (isSeriesNextKey(s, possibleTextSeries[i] as string[], textSeries[i])) {
          (possibleTextSeries[i] as string[]).push(s);
        } else {
          possibleTextSeries[i] = false;
        }
      }
    }
  }

  for (let i = 0; i < possibleTextSeries.length; i++) {
    const entry = possibleTextSeries[i];
    if (entry !== false) {
      const results: Cell[] = [];
      if (negative) {
        const stringList = entry as string[];
        let current = stringList[0];
        for (let j = 0; j < spaces; j++) {
          current = getSeriesNextKey(current, textSeries[i], true);
          results.push({ type: 'TEXT', value: current } as Cell);
        }
        results.reverse();
      } else {
        const stringList = entry as string[];
        let current = stringList[stringList.length - 1];
        for (let j = 0; j < spaces; j++) {
          current = getSeriesNextKey(current, textSeries[i], false);
          results.push({ type: 'TEXT', value: current } as Cell);
        }
      }
      return results;
    }
  }

  // no case found
  return copySeries(options);
}

export const findAutoComplete = (options: Series): (Cell | undefined)[] => {
  const { series } = options;

  // if cells are missing, just copy series
  if (!series.every((s) => !!s)) {
    return copySeries(options);
  }

  // number series first
  if (series.every((s) => s && s.type === 'TEXT' && isStringANumber(s.value))) {
    return findNumberSeries(options);
  }

  // string series
  return findStringSeries(options);
};
