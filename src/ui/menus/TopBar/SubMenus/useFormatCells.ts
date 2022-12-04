import { ColorResult } from 'react-color';
import { CellFormat } from '../../../../core/gridDB/gridTypes';
import { Sheet } from '../../../../core/gridDB/tempSheet';
import { Coordinate } from '../../../../core/gridGL/types/size';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: () => void;
}

type CellFormatNoPosition = Exclude<CellFormat, 'x' | 'y'>;

interface Props {
  sheet: Sheet;
}

export const useFormatCells = (props: Props): IResults => {
  const { start, end } = useGetSelection();

  const onFormat = (updatedFormat: CellFormatNoPosition): void => {
    const formats: CellFormat[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const format = props.sheet.grid.getFormat(x, y) ?? { x, y };
        formats.push({ ...format, ...updatedFormat });
      }
    }
    props.sheet.grid.updateFormat(formats);
  };

  const changeFillColor = (color: ColorResult): void => {
    onFormat({ fillColor: convertReactColorToString(color) });
  };

  const removeFillColor = () => {
    onFormat({ fillColor: undefined });
  };

  const clearFormatting = (): void => {
    const clear: Coordinate[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        clear.push({ x, y });
      }
    }
    props.sheet.grid.clearFormat(clear);
  };

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
  };
};
