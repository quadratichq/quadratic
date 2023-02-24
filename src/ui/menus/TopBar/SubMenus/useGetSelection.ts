import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../../atoms/gridInteractionStateAtom';
import { Coordinate } from '../../../../gridGL/types/size';
import { Sheet } from '../../../../grid/sheet/Sheet';
import { CellFormat } from '../../../../grid/sheet/gridTypes';
import { FORMAT_SELECTION_EVENT } from './useFormatCells';

export type MultipleBoolean = true | false | 'multiple';
export type MultipleString = string | 'multiple';

export interface MultipleFormat {
  bold: MultipleBoolean;
  italic: MultipleBoolean;
  textColor: string | undefined | 'multiple';
}

interface GetSelection {
  start: Coordinate;
  end: Coordinate;
  multiCursor: boolean;
  format: MultipleFormat;
}

const setFormat = (cells: CellFormat[]): MultipleFormat => {
  let bold: MultipleBoolean | undefined;
  let italic: MultipleBoolean | undefined;
  let textColor: string | undefined | 'multiple';

  cells.forEach((cell) => {
    if (cell.bold === true) {
      if (bold !== 'multiple') {
        if (bold === false) {
          bold = 'multiple';
        } else {
          bold = true;
        }
      }
    } else if (cell.bold === false) {
      if (bold === true) {
        bold = 'multiple';
      }
      bold = cell.bold;
    }

    if (cell.italic === true) {
      if (italic !== 'multiple') {
        if (italic === false) {
          italic = 'multiple';
        } else {
          italic = true;
        }
      }
    } else if (cell.italic === false) {
      if (italic === true) {
        italic = 'multiple';
      }
      italic = cell.italic;
    }

    if (cell.textColor) {
      if (textColor !== 'multiple') {
        if (textColor === undefined) {
          textColor = cell.textColor;
        } else if (textColor !== cell.textColor) {
          textColor = 'multiple';
        }
      }
    } else if (textColor !== cell.textColor) {
      textColor = 'multiple';
    }
  });

  return {
    bold: bold ?? false,
    italic: italic ?? false,
    textColor,
  };
};

export const useGetSelection = (sheet: Sheet): GetSelection => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;

  // used to trigger a new format calculation after a format change (see useFormatCells.ts)
  const [trigger, setTrigger] = useState(0);
  const setTriggerCallback = useCallback(() => {
    setTrigger((trigger) => trigger + 1);
  }, []);

  useEffect(() => {
    window.addEventListener(FORMAT_SELECTION_EVENT, setTriggerCallback);

    return () => {
      window.removeEventListener(FORMAT_SELECTION_EVENT, setTriggerCallback);
    };
  }, [setTriggerCallback]);

  return useMemo(() => {
    let start: Coordinate, end: Coordinate, format: MultipleFormat;
    if (multiCursor) {
      start = interactionState.multiCursorPosition.originPosition;
      end = interactionState.multiCursorPosition.terminalPosition;
      format = setFormat(sheet.grid.getNakedFormat(start.x, start.y, end.x, end.y));
    } else {
      start = interactionState.cursorPosition;
      end = interactionState.cursorPosition;
      const cellFormat = sheet.grid.getFormat(start.x, start.y);
      if (cellFormat) {
        format = setFormat([cellFormat]);
      } else {
        format = setFormat([]);
      }
    }
    return { start, end, multiCursor, format };

    // this is needed for trigger to cause a useMemo change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    multiCursor,
    interactionState.multiCursorPosition.originPosition,
    interactionState.multiCursorPosition.terminalPosition,
    interactionState.cursorPosition,
    sheet.grid,
    trigger,
  ]);
};
