import { borderMenuAtom } from '@/app/atoms/borderMenuAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { convertColorStringToTint, convertTintToArray } from '@/app/helpers/convertColor';
import { BorderSelection, BorderStyle, CellBorderLine } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

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
    (options: ChangeBorder): void => {
      setBorderMenuState((prev) => {
        const selection = options.selection ?? prev.selection;
        const color = options.color ?? prev.color;
        const line = options.line ?? prev.line;
        const cursor = sheets.sheet.cursor;
        if (cursor.multiCursor && cursor.multiCursor.length > 1) {
          console.log('TODO: implement multiCursor border support');
        } else {
          const colorTint = convertColorStringToTint(color);
          const colorArray = convertTintToArray(colorTint);
          const style: BorderStyle = {
            color: {
              red: Math.floor(colorArray[0] * 255),
              green: Math.floor(colorArray[1] * 255),
              blue: Math.floor(colorArray[2] * 255),
              alpha: 1,
            },
            line,
          };
          const rustSelection = sheets.getRustSelection();
          if (options.selection) {
            quadraticCore.setBorders(rustSelection, options.selection, style);
          } else if (
            prev.selection &&
            ((!!options.color && options.color !== prev.color) || (!!options.line && options.line !== prev.line))
          ) {
            quadraticCore.setBorders(rustSelection, prev.selection, style);
          }
        }
        return { selection, color, line };
      });
    },
    [setBorderMenuState]
  );

  const clearBorders = useCallback((): void => {
    const cursor = sheets.sheet.cursor;
    if (cursor.multiCursor && cursor.multiCursor.length > 1) {
      console.log('TODO: implement multiCursor border support');
      return;
    }
    quadraticCore.setBorders(sheets.getRustSelection(), 'clear');
  }, []);

  return {
    changeBorders,
    clearBorders,
  };
};
