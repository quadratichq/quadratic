import { events } from '@/app/events/events';
import { Point } from 'pixi.js';
import { atom } from 'recoil';

interface TableHeading {
  world?: Point;
  column: number | null;
  row: number | null;
}

const defaultTableHeadingState: TableHeading = {
  world: undefined,
  column: null,
  row: null,
};

export const tableHeadingAtom = atom({
  key: 'tableHeadingState',
  default: defaultTableHeadingState,
  effects: [
    ({ setSelf }) => {
      const clear = () => {
        setSelf(() => ({ world: undefined, column: null, row: null }));
      };

      const set = (world: Point, column: number | null, row: number | null) => {
        setSelf(() => ({ world, column, row }));
      };

      events.on('cursorPosition', clear);
      events.on('tableContextMenu', set);

      return () => {
        events.off('cursorPosition', clear);
        events.off('tableContextMenu', set);
      };
    },
  ],
});
