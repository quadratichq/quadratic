import { JsSheetPos } from '@/app/quadratic-core-types';

export interface CodeRun {
  transactionId: string;
  sheetPos: JsSheetPos;
  code: string;
}
