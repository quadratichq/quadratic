import { SheetController } from '../../../../grid/controller/SheetController';
import { transactionResponse } from '../../../../grid/controller/transactionResponse';

interface IResults {
  clearAllFormatting: () => void;
}

export const useClearAllFormatting = (sheetController: SheetController): IResults => {
  const clearAllFormatting = () => {
    const summary = sheetController.sheet.clearFormatting();
    transactionResponse(sheetController, summary);
  };

  return {
    clearAllFormatting,
  };
};
