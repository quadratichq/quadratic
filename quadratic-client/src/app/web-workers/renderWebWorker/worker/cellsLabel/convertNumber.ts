import { JsNumber } from '@/app/quadratic-core-types';

// Converts a number to a string with the given cell formatting
export const convertNumber = (n: string, format: JsNumber, currentFractionDigits?: number): string => {
  const options: Intl.NumberFormatOptions = {
    style: format.format?.type === 'PERCENTAGE' ? 'percent' : 'decimal',
    useGrouping: !!format.commas,
  };
  if (currentFractionDigits) {
    options.minimumFractionDigits = currentFractionDigits;
    options.maximumFractionDigits = currentFractionDigits;
  } else if (format.decimals !== null) {
    options.minimumFractionDigits = format.decimals;
    options.maximumFractionDigits = format.decimals;
  } else {
    options.minimumFractionDigits = 0;

    // maximum faction digits w/o throwing test error (probably related to the size of floats in JS)
    options.maximumFractionDigits = 20;
  }
  let number = new Intl.NumberFormat(undefined, options).format(parseFloat(n));
  if (format.format?.type === 'CURRENCY') {
    options.style = 'currency';
    if (format.format.symbol) {
      number = `${format.format.symbol}${number}`;
    } else {
      throw new Error('Expected format.symbol to be defined in convertNumber.ts');
    }
  }
  return number;
};

// Reduces the number of decimals (used by rendering to show a fractional number in a smaller-width cell)
export const reduceDecimals = (
  current: string,
  original: string,
  format: JsNumber,
  currentFractionDigits?: number
): { number: string; currentFractionDigits: number } | undefined => {
  // this only works if there is a fractional part
  if (original.includes('.')) {
    if (currentFractionDigits === undefined) {
      const split = original.split('.');
      currentFractionDigits = split[1].length - 1;
    }
    const updated = convertNumber(original, format, currentFractionDigits);
    if (updated !== current) {
      return { number: updated, currentFractionDigits };
    }
  }
};
