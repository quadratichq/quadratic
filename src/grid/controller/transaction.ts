import { SheetCursorSave } from '../sheet/SheetCursor';
import { Statement } from './statement';

export type Transaction = {
  statements: Statement[];
  cursor?: SheetCursorSave;
};
