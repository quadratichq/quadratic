import { SheetController } from '../../../../grid/controller/sheetController';
import { useBorders } from './useBorders';
import { useFormatCells } from './useFormatCells';

interface IResults {
  clearAllFormatting: () => void;
}

export const useClearAllFormatting = (sheet_controller: SheetController): IResults => {
  const { clearFormatting } = useFormatCells(sheet_controller);
  const { clearBorders } = useBorders(sheet_controller);

  const clearAllFormatting = () => {
    sheet_controller.start_transaction();
    clearFormatting({ create_transaction: false });
    clearBorders({ create_transaction: false });
    sheet_controller.end_transaction();
  };

  return {
    clearAllFormatting,
  };
};
