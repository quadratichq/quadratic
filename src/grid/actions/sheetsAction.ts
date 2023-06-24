import { SheetController } from '../controller/sheetController';
import { Sheet } from '../sheet/Sheet';

export const createSheet = (args: { sheetController: SheetController; sheet: Sheet; create_transaction?: boolean }) => {
  const { create_transaction, sheetController, sheet } = args;

  if (create_transaction ?? true) sheetController.start_transaction();

  sheetController.execute_statement({
    type: 'SET_SHEET',
    data: {
      sheetId: sheet.id,
      sheet,
    },
  });

  if (create_transaction ?? true) {
    sheetController.end_transaction();
  }
};

export const deleteSheet = (args: { sheetController: SheetController; sheet: Sheet; create_transaction: boolean }) => {
  const { create_transaction, sheetController, sheet } = args;

  if (create_transaction ?? true) sheetController.start_transaction();

  sheetController.execute_statement({
    type: 'SET_SHEET',
    data: {
      sheetId: sheet.id,
      sheet: undefined,
    },
  });

  if (sheetController.sheets.length === 0) {
    const sheet = sheetController.createNewSheet();
    createSheet({ sheetController, sheet, create_transaction: false });
  }

  if (create_transaction ?? true) {
    sheetController.end_transaction();
  }
};

export const changeSheetOrder = (args: {
  sheetController: SheetController;
  sheet: Sheet;
  order?: string;
  delta?: number;
  create_transaction: boolean;
}) => {
  const { create_transaction, sheetController, sheet, order, delta } = args;

  if (create_transaction ?? true) sheetController.start_transaction();

  sheetController.execute_statement({
    type: 'SET_SHEET_ORDER',
    data: {
      sheetId: sheet.id,
      order,
      delta,
    },
  });

  if (create_transaction ?? true) {
    sheetController.end_transaction();
  }
};
