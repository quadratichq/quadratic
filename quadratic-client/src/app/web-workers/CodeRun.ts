import { SheetPosTS } from '@/app/gridGL/types/size';

export interface CodeRun {
  transactionId: string;
  sheetPos: SheetPosTS;
  code: string;
}
