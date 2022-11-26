import { ColorResult } from 'react-color';
import { updateFormatDB } from '../../../../core/gridDB/Cells/UpdateFormatDB';
import { CellFormat } from '../../../../core/gridDB/db';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: () => void;
}

type CellFormatNoPosition = Exclude<CellFormat, 'x' | 'y'>;

interface IProps {
  app?: PixiApp;
}

export const useFormatCells = (props: IProps): IResults => {
  const { start, end } = useGetSelection();

  const onFormat = (updatedFormat: CellFormatNoPosition): void => {
    if (!props.app) return;
    const formats: CellFormat[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const format = props.app.grid.getFormat(x, y) ?? { x, y };
        formats.push({ ...format, ...updatedFormat });
      }
    }
    updateFormatDB(formats);
  };

  const changeFillColor = (color: ColorResult): void => {
    onFormat({ fillColor: convertReactColorToString(color) });
  };

  const removeFillColor = () => {
    onFormat({ fillColor: undefined });
  };

  const clearFormatting = (): void => {
    if (!props.app) return;

    // todo: clear formatting w/clearing borders

    // const cells: { x: number; y: number }[] = [];
    // const formats: CellFormat[] = [];
    // for (let y = start.y; y <= end.y; y++) {
    //   for (let x = start.x; x <= end.x; x++) {
    //     cells.push({ x, y });

    //     // clear neighbor's borderBottom above
    //     if (y === start.y) {
    //       const format = props.app.grid.getFormat(x, y - 1);
    //       if (format?.border && format.border & borderBottom) {
    //         formats.push({ ...format, border: format.border & (borderAll ^ borderBottom) });
    //       }
    //     }

    //     // clear neighbor's borderTop below
    //     if (y === end.y) {
    //       const format = props.app.grid.getFormat(x, y + 1);
    //       if (format?.border && format.border & borderTop) {
    //         formats.push({ ...format, border: format.border & (borderAll ^ borderTop) });
    //       }
    //     }
    //   }

    //   // clear neighbor's borderRight to the left
    //   const left = props.app.grid.getFormat(start.x - 1, y);
    //   if (left?.border && left.border & borderRight) {
    //     formats.push({ ...left, border: left.border & (borderAll ^ borderRight) });
    //   }

    //   // clear neighbor's borderLeft to the right
    //   const right = props.app.grid.getFormat(end.x + 1, y);
    //   if (right?.border && right.border & borderLeft) {
    //     formats.push({ ...right, border: right.border & (borderAll ^ borderLeft) });
    //   }
    // }
    // clearFormatDB(cells);
    // if (formats.length) {
    //   updateFormatDB(formats);
    // }
  };

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
  };
};
