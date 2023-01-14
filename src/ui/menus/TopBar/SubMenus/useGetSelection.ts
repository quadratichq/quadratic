import { useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../../atoms/gridInteractionStateAtom';
import { Coordinate } from '../../../../core/gridGL/types/size';

interface GetSelection {
  start: Coordinate;
  end: Coordinate;
  multiCursor: boolean;
}

export const useGetSelection = (): GetSelection => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;

  return useMemo(() => {
    let start: Coordinate, end: Coordinate;
    if (multiCursor) {
      start = interactionState.multiCursorPosition.originPosition;
      end = interactionState.multiCursorPosition.terminalPosition;
    } else {
      start = interactionState.cursorPosition;
      end = interactionState.cursorPosition;
    }
    return { start, end, multiCursor };
  }, [interactionState.multiCursorPosition, interactionState.cursorPosition, multiCursor]);
};
