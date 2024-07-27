import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { convertColorStringToTint, convertTintToArray } from '@/app/helpers/convertColor';
import type { BorderSelection, BorderStyle, CellBorderLine } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export interface ChangeBorder {
  selection?: BorderSelection;
  color?: string;
  type?: CellBorderLine;
}

export interface UseBordersResults {
  changeBorders: (options: ChangeBorder) => void;
  clearBorders: (args?: { create_transaction?: boolean }) => void;
  disabled: boolean;
}

export const useBorders = (): UseBordersResults => {
  const changeBorders = (options: ChangeBorder): void => {
    const cursor = sheets.sheet.cursor;
    if (cursor.multiCursor && cursor.multiCursor.length > 1) {
      console.log('TODO: implement multiCursor border support');
      return;
    }
    const rectangle = cursor.multiCursor
      ? cursor.multiCursor[0]
      : new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1);
    const sheet = sheets.sheet;
    const colorTint = options.color === undefined ? colors.defaultBorderColor : convertColorStringToTint(options.color);
    const colorArray = convertTintToArray(colorTint);
    const selection = options.selection === undefined ? 'all' : options.selection;
    const style: BorderStyle = {
      color: {
        red: Math.floor(colorArray[0] * 255),
        green: Math.floor(colorArray[1] * 255),
        blue: Math.floor(colorArray[2] * 255),
        alpha: 0xff,
      },
      line: options.type ?? 'line1',
    };
    quadraticCore.setRegionBorders(sheet.id, rectangle, selection, style);
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
