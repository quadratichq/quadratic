import { JsNumber } from '@/app/quadratic-core-types';

// Converts a number to a string with the given cell formatting
export const convertNumber = (n: string, format: JsNumber): string => {
  const options: Intl.NumberFormatOptions = {
    style: format.format?.type === 'PERCENTAGE' ? 'percent' : 'decimal',
    useGrouping: !!format.commas,
  };
  if (format.decimals !== null) {
    options.minimumFractionDigits = format.decimals;
    options.maximumFractionDigits = format.decimals;
  } else if (format.format?.type === 'PERCENTAGE') {
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
