import { useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../../atoms/gridInteractionStateAtom';
import { Coordinate } from '../../../../core/gridGL/types/size';
import { Sheet } from '../../../../core/gridDB/Sheet';

export type MultipleBoolean = true | false | "some";
export type MultipleString = string | "multiple";

interface MultipleFormat {
  bold: MultipleBoolean;
  italics: MultipleBoolean;
  textColor: string | undefined | "multiple";
}

interface GetSelection {
  start: Coordinate;
  end: Coordinate;
  multiCursor: boolean;
  format: MultipleFormat;
}

const setFormat = (format: MultipleFormat, sheet: Sheet): void => {

};

export const useGetSelection = (sheet: Sheet): GetSelection => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;

  return useMemo(() => {
    let start: Coordinate, end: Coordinate, format: MultipleFormat = { bold: false, italics: false, textColor: undefined };
    if (multiCursor) {
      start = interactionState.multiCursorPosition.originPosition;
      end = interactionState.multiCursorPosition.terminalPosition;
      setFormat(format, sheet.grid.getNakedCells(start.x, start.y, end.x, end.y));
    } else {
      start = interactionState.cursorPosition;
      end = interactionState.cursorPosition;
    }
    return { start, end, multiCursor, format };
  }, [interactionState.multiCursorPosition, interactionState.cursorPosition, multiCursor]);
};
