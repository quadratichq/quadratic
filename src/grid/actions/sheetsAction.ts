import { SheetController } from '../controller/_sheetController';
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

// updates an attribute in sheet (note that you should only update one attribute at a time)
export const updateSheet = (args: {
  sheetController: SheetController;
  sheet: Sheet;
  order?: string;
  color?: string | null;
  create_transaction: boolean;
}) => {
  const { create_transaction, sheetController, sheet, order, color } = args;

  if (create_transaction ?? true) sheetController.start_transaction();

  if (order !== undefined) {
    sheetController.execute_statement({
      type: 'UPDATE_SHEET',
      data: {
        sheetId: sheet.id,
        order,
      },
    });
  } else if (color !== undefined) {
    sheetController.execute_statement({
      type: 'UPDATE_SHEET',
      data: {
        sheetId: sheet.id,
        color,
      },
    });
  }

  if (create_transaction ?? true) {
    sheetController.end_transaction();
  }
};
