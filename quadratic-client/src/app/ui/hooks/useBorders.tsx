import { borderMenuAtom } from '@/app/atoms/borderMenuAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { convertColorStringToTint, convertTintToArray } from '@/app/helpers/convertColor';
import type { BorderSelection, BorderStyle, CellBorderLine } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

// used as a place-holder for clear color
const CLEAR_COLOR = 'rgb(18, 52, 86)'; // #123456

export interface ChangeBorder {
  selection?: BorderSelection;
  color?: string;
  line?: CellBorderLine;
}

export interface UseBordersResults {
  changeBorders: (options: ChangeBorder) => void;
  clearBorders: (args?: { create_transaction?: boolean }) => void;
}

export const useBorders = (): UseBordersResults => {
  const setBorderMenuState = useSetRecoilState(borderMenuAtom);

  const changeBorders = useCallback(
    (options: ChangeBorder) => {
      setBorderMenuState((prev) => {
        const selection = options.selection ?? prev.selection;
        const color = options.color ?? prev.color;
        const line = options.line ?? prev.line;
        const colorTint = convertColorStringToTint(color);
        const colorArray = convertTintToArray(colorTint);
        let style: BorderStyle | undefined;

        if (color === CLEAR_COLOR) {
          style = undefined;
        } else {
          style = {
            color: {
              red: Math.floor(colorArray[0] * 255),
              green: Math.floor(colorArray[1] * 255),
              blue: Math.floor(colorArray[2] * 255),
              alpha: 255,
            },
            line,
          };
        }
        const rustSelection = sheets.getRustSelection();
        if (options.selection) {
          quadraticCore.setBorders(rustSelection, options.selection, style, false);
        } else if (
          prev.selection &&
          ((!!options.color && options.color !== prev.color) || (!!options.line && options.line !== prev.line))
        ) {
          quadraticCore.setBorders(rustSelection, prev.selection, style, false);
        }
        return { selection, color, line };
      });
    },
    [setBorderMenuState]
  );

  const clearBorders = useCallback((): void => {
    quadraticCore.setBorders(sheets.getRustSelection(), 'clear', undefined, false);
  }, []);

  return {
    changeBorders,
    clearBorders,
  };
};
