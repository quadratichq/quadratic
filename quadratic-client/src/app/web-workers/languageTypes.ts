import { SheetPosTS } from '@/app/gridGL/types/size';

export type LanguageState = 'loading' | 'ready' | 'error' | 'running';

export interface CodeRun {
  transactionId: string;
  sheetPos: SheetPosTS;
  code: string;
}
