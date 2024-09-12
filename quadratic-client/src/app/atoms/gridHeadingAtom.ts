import { events } from '@/app/events/events';
import { Point } from 'pixi.js';
import { atom } from 'recoil';

interface GridHeading {
  world?: Point;
  column?: number;
  row?: number;
}

const defaultGridHeadingState: GridHeading = {
  world: undefined,
  column: undefined,
  row: undefined,
};

export const gridHeadingAtom = atom({
  key: 'gridHeadingState',
  default: defaultGridHeadingState,
  effects: [
    ({ setSelf }) => {
      const clear = () => {
        setSelf(() => ({ world: undefined, column: undefined, row: undefined }));
      };

      const set = (world?: Point, column?: number, row?: number) => {
        setSelf(() => ({ world, column, row }));
      };

      events.on('cursorPosition', clear);
      events.on('gridHeadingContextMenu', set);

      return () => {
        events.off('cursorPosition', clear);
        events.off('gridHeadingContextMenu', set);
      };
    },
  ],
});
