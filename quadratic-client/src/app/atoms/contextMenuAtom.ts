import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { JsRenderCodeCell } from '@/app/quadratic-core-types';
import type { Point } from 'pixi.js';
import { atom } from 'recoil';

export enum ContextMenuType {
  Grid = 'grid',
  Table = 'table',
  TableSort = 'table-sort',
  TableColumn = 'table-column',
  CodeCellOutput = 'code-cell-output',
}

export interface ContextMenuState {
  type?: ContextMenuType;
  world?: Point;
  column?: number;
  row?: number;
  table?: JsRenderCodeCell;

  // special states we need to track rename for tables
  rename?: boolean;
  selectedColumn?: number;
  initialValue?: string;
}

export const defaultContextMenuState: ContextMenuState = {
  type: undefined,
  world: undefined,
  column: undefined,
  row: undefined,
  table: undefined,
  rename: undefined,
  selectedColumn: undefined,
  initialValue: undefined,
};

export const contextMenuAtom = atom({
  key: 'contextMenuState',
  default: defaultContextMenuState,
  effects: [
    ({ setSelf }) => {
      const clear = () => {
        setSelf(() => ({}));
        focusGrid();
      };

      const set = (options: ContextMenuState) => {
        if (!options.type) {
          clear();
        } else {
          setSelf(() => options);
        }
      };

      events.on('cursorPosition', clear);
      events.on('contextMenu', set);

      return () => {
        events.off('cursorPosition', clear);
        events.off('contextMenu', set);
      };
    },
  ],
});
