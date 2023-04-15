import { PixiApp } from '../../../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../grid/controller/sheetController';
import { useBorders } from './useBorders';
import { useFormatCells } from './useFormatCells';
import { PixiAppTables } from 'gridGL/tables/pixiAppTables/PixiAppTables';

interface IResults {
  clearAllFormatting: () => void;
}

export const useClearAllFormatting = (sheet_controller: SheetController, app: PixiApp | PixiAppTables): IResults => {
  const { clearFormatting } = useFormatCells(sheet_controller, app);
  const { clearBorders } = useBorders(sheet_controller.sheet, app);

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
