import { events } from '@/app/events/events';
import { Point } from 'pixi.js';
import { atom } from 'recoil';

export enum ContextMenuType {
  Grid = 'grid',
  Table = 'table',
}

interface ContextMenu {
  type?: ContextMenuType;
  world?: Point;
  column: number | null;
  row: number | null;
}

const defaultContextMenuState: ContextMenu = {
  world: undefined,
  column: null,
  row: null,
};

export const contextMenuAtom = atom({
  key: 'contextMenuState',
  default: defaultContextMenuState,
  effects: [
    ({ setSelf }) => {
      const clear = () => {
        setSelf(() => ({ type: undefined, world: undefined, column: null, row: null }));
      };

      const set = (type: ContextMenuType, world: Point, column: number | null, row: number | null) => {
        setSelf(() => ({ type, world, column, row }));
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
