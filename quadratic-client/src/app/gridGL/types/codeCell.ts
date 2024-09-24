import { Coordinate } from '@/app/gridGL/types/size';
import { CodeCellLanguage } from '@/app/quadratic-core-types';

export interface CodeCell {
  sheetId: string;
  pos: Coordinate;
  language: CodeCellLanguage;
}
