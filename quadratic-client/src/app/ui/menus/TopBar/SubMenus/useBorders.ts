import { borderMenuAtom } from '@/app/atoms/borderMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { convertColorStringToTint, convertTintToArray } from '@/app/helpers/convertColor';
import { BorderSelection, BorderStyle, CellBorderLine } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';

export interface ChangeBorder {
  selection?: BorderSelection;
  color?: string;
  line?: CellBorderLine;
}

export interface UseBordersResults {
  changeBorders: (options: ChangeBorder) => void;
  clearBorders: (args?: { create_transaction?: boolean }) => void;
  disabled: boolean;
}

export const useBorders = (): UseBordersResults => {
  const setBorderMenuState = useSetRecoilState(borderMenuAtom);

  const changeBorders = (options: ChangeBorder): void => {
    setBorderMenuState((prev) => {
      const selection = options.selection ?? prev.selection;
      const color = options.color ?? prev.color;
      const line = options.line ?? prev.line;
      const cursor = sheets.sheet.cursor;
      if (cursor.multiCursor && cursor.multiCursor.length > 1) {
        console.log('TODO: implement multiCursor border support');
      } else {
        const rectangle = cursor.multiCursor
          ? cursor.multiCursor[0]
          : new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1);
        const sheet = sheets.sheet;
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
        if (options.selection) {
          quadraticCore.setRegionBorders(sheet.id, rectangle, options.selection, style);
        } else if (
          prev.selection &&
          ((!!options.color && options.color !== prev.color) || (!!options.line && options.line !== prev.line))
        ) {
          quadraticCore.setRegionBorders(sheet.id, rectangle, prev.selection, style);
        }
      }
      return { selection, color, line };
    });
  };

  const clearBorders = (): void => {
    const cursor = sheets.sheet.cursor;
    if (cursor.multiCursor && cursor.multiCursor.length > 1) {
      console.log('TODO: implement multiCursor border support');
      return;
    }
    const rectangle = cursor.multiCursor
      ? cursor.multiCursor[0]
      : new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1);
    quadraticCore.setRegionBorders(sheets.sheet.id, rectangle, 'clear');
  };

  const [disabled, setDisabled] = useState(false);
  useEffect(() => {
    const cursorPosition = () => {
      if (
        (sheets.sheet.cursor.multiCursor && sheets.sheet.cursor.multiCursor.length > 1) ||
        sheets.sheet.cursor.columnRow !== undefined
      ) {
        setDisabled(true);
      } else {
        setDisabled(false);
      }
    };
    events.on('cursorPosition', cursorPosition);
    return () => {
      events.off('cursorPosition', cursorPosition);
    };
  }, []);

  return {
    changeBorders,
    clearBorders,
    disabled,
  };
};
