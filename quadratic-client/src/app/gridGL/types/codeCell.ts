import type { CodeCellLanguage, JsCoordinate } from '@/app/quadratic-core-types';

export interface CodeCell {
  sheetId: string;
  pos: JsCoordinate;
  language: CodeCellLanguage;
}
