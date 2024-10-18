import { events } from '@/app/events/events';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Point } from 'pixi.js';
import { atom } from 'recoil';

export enum ContextMenuType {
  Grid = 'grid',
  Table = 'table',
}

export interface ContextMenuState {
  type?: ContextMenuType;
  world?: Point;
  column?: number;
  row?: number;
  table?: JsRenderCodeCell;
}

export const defaultContextMenuState: ContextMenuState = {
  world: undefined,
  column: undefined,
  row: undefined,
  table: undefined,
};

export interface ContextMenuOptions {
  type?: ContextMenuType;
  world?: Point;
  column?: number;
  row?: number;
  table?: JsRenderCodeCell;
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
        if (!options.table) {
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
