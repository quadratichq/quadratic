import { events } from '@/app/events/events';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Point } from 'pixi.js';
import { atom } from 'recoil';

export enum ContextMenuType {
  Grid = 'grid',
  Table = 'table',
  TableSort = 'table-sort',
  TableColumn = 'table-column',
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
}

export const defaultContextMenuState: ContextMenuState = {
  world: undefined,
  column: undefined,
  row: undefined,
  table: undefined,
  rename: undefined,
  selectedColumn: undefined,
};

export interface ContextMenuOptions {
  type?: ContextMenuType;
  world?: Point;
  column?: number;
  row?: number;
  table?: JsRenderCodeCell;
  rename?: boolean;
  selectedColumn?: number;
}

export const contextMenuAtom = atom({
  key: 'contextMenuState',
  default: defaultContextMenuState,
  effects: [
    ({ setSelf }) => {
      const clear = () => {
        setSelf(() => ({}));
        events.emit('contextMenuClose');
      };

      const set = (options: ContextMenuOptions) => {
        setSelf(() => options);
        if (!options.type) {
          events.emit('contextMenuClose');
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
