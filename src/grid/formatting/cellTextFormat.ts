export const DEFAULT_NUMBER_OF_DECIMAL_PLACES = 2;

export type CellTextFormat =
  | {
      type: 'NUMBER';
      decimalPlaces?: number;
    }
  | {
      type: 'CURRENCY';
      display: 'CURRENCY';
      symbol?: string;
      decimalPlaces?: number;
    }
  | {
      type: 'PERCENTAGE';
      decimalPlaces?: number;
    }
  | {
      type: 'EXPONENTIAL';
      decimalPlaces?: number;
    };
