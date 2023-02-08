export type CellTextFormat =
  | {
      type: 'NUMBER';
      decimalPlaces?: number;
    }
  | {
      type: 'CURRENCY';
      symbol?: string;
      display: 'ACCOUNTING' | 'FINANCIAL' | 'CURRENCY';
      decimalPlaces?: number;
    }
  | {
      type: 'PERCENTAGE';
      decimalPlaces?: number;
    }
  | {
      type: 'DATE';
      format: string;
    }
  | {
      type: 'EXPONENTIAL';
    };
