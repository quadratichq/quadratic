import { events } from '@/app/events/events';
import { Point } from 'pixi.js';
import { atom } from 'recoil';

interface GridHeading {
  world?: Point;
  column: number | null;
  row: number | null;
}

const defaultGridHeadingState: GridHeading = {
  world: undefined,
  column: null,
  row: null,
};

export const gridHeadingAtom = atom({
  key: 'gridHeadingState',
  default: defaultGridHeadingState,
  effects: [
    ({ setSelf }) => {
      const clear = () => {
        setSelf(() => ({ world: undefined, column: null, row: null }));
      };

      const set = (world: Point, column: number | null, row: number | null) => {
        setSelf(() => ({ world, column, row }));
      };

      events.on('cursorPosition', clear);
      events.on('gridContextMenu', set);

      return () => {
        events.off('cursorPosition', clear);
        events.off('gridContextMenu', set);
      };
    },
  ],
});
