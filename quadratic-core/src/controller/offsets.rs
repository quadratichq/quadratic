use crate::grid::SheetId;

use super::{
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};

impl GridController {
    pub fn set_column_width(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        width: f32,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let column_id = sheet.get_or_create_column(x).0.id;
        let ops = vec![Operation::SetColumnWidth {
            sheet_id,
            column_id,
            width,
        }];
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn set_row_height(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        height: f32,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let row_id = sheet.get_or_create_row(x).id;
        let ops = vec![Operation::SetRowHeight {
            sheet_id,
            row_id,
            height,
        }];
        self.transact_forward(Transaction { ops, cursor })
    }

    pub fn reset_column_width(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        cursor: Option<String>,
    ) -> TransactionSummary {
        self.set_column_width(sheet_id, x, crate::DEFAULT_COLUMN_WIDTH, cursor)
    }
    pub fn reset_row_height(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        cursor: Option<String>,
    ) -> TransactionSummary {
        self.set_row_height(sheet_id, x, crate::DEFAULT_ROW_HEIGHT, cursor)
    }
}
