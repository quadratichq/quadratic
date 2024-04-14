import { SheetPosTS } from '@/gridGL/types/size';

export type LanguageState = 'loading' | 'ready' | 'error' | 'running';

export interface CodeRun {
  transactionId: string;
  sheetPos: SheetPosTS;
  sheetName: string;
  code: string;
}
