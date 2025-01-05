import { events } from '@/app/events/events';
import { convertTintToString } from '@/app/helpers/convertColor';
import type { BorderSelection, CellBorderLine } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { atom, DefaultValue } from 'recoil';

interface BorderMenuState {
  selection?: BorderSelection;
  color: string;
  line: CellBorderLine;
}

const defaultBorderMenuState: BorderMenuState = {
  selection: undefined,
  color: convertTintToString(colors.defaultBorderColor),
  line: 'line1',
};

export const borderMenuAtom = atom({
  key: 'borderMenuState',
  default: defaultBorderMenuState,
  effects: [
    ({ setSelf }) => {
      const clearSelection = () => {
        setSelf((prev) => {
          if (prev instanceof DefaultValue) return defaultBorderMenuState;
          return { ...prev, selection: undefined };
        });
      };
      events.on('cursorPosition', clearSelection);
      return () => {
        events.off('cursorPosition', clearSelection);
      };
    },
  ],
});
