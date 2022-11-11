import Color from 'color';
import { ColorResult } from 'react-color';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../../atoms/gridInteractionStateAtom';
import { updateFormatDB } from '../../../../core/gridDB/Cells/UpdateFormatDB';
import { CellFormat } from '../../../../core/gridDB/db';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
}

export const useFormatCells = (): IResults => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;

  const onFormat = (options: { fillColor?: string; }): void => {
    const format: CellFormat = {};
    if (options.fillColor !== undefined) {
      format.fillColor = options.fillColor;
    }
    if (multiCursor) {
      const start = interactionState.multiCursorPosition.originPosition;
      const end = interactionState.multiCursorPosition.terminalPosition;
      const formats: CellFormat[] = [];
      for (let y = start.y; y <= end.y; y++) {
        for (let x = start.x; x <= end.x; x++) {
          formats.push({ ...format, x, y });
        }
      }
      updateFormatDB(formats);
    } else {
      format.x = interactionState.cursorPosition.x;
      format.y = interactionState.cursorPosition.y;
      updateFormatDB([format]);
    }
  };

  const changeFillColor = (result: ColorResult) => {
    const rgb = result.rgb;
    onFormat({ fillColor: Color({ r: rgb.r, g: rgb.g, b: rgb.b }).rgb().toString() });
  };

  const removeFillColor = () => {
    onFormat({ fillColor: undefined });
  }

  return {
    changeFillColor,
    removeFillColor,
  };
}