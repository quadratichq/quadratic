import type { SheetPosTS } from '@/app/shared/types/size';

export interface CodeRun {
  transactionId: string;
  sheetPos: SheetPosTS;
  code: string;
  chartPixelWidth: number | null;
  chartPixelHeight: number | null;
}
