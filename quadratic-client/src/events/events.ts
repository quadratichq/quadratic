import { JsRenderFill, SheetInfo } from '@/quadratic-core-types';
import EventEmitter from 'eventemitter3';

export interface EventTypes {
  undoRedo: {
    undo: boolean;
    redo: boolean;
  };

  addSheet: {
    sheetId: string;
    name: string;
    order: string;
  };

  sheetInfo: {
    sheetInfo: SheetInfo[];
  };

  sheetFills: {
    sheetId: string;
    fills: JsRenderFill[];
  };
}

export const events = new EventEmitter<EventTypes>();
