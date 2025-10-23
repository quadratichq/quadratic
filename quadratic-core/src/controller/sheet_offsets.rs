use super::active_transactions::transaction_name::TransactionName;
use super::{GridController, operations::operation::Operation};
use crate::grid::SheetId;
use crate::sheet_offsets::resize_transient::TransientResize;

impl GridController {
    /// Commits a transient resize from a local version of SheetOffsets.
    /// see js_get_resize_to_apply
    pub fn commit_offsets_resize(
        &mut self,
        sheet_id: SheetId,
        transient_resize: TransientResize,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let mut ops = vec![];
        let mut transaction_name = TransactionName::Unknown;
        if let Some(column) = transient_resize.column {
            transaction_name = TransactionName::ResizeColumn;
            ops.push(Operation::ResizeColumn {
                sheet_id,
                column,
                new_size: transient_resize.new_size,
                client_resized: true,
            });
        } else if let Some(row) = transient_resize.row {
            transaction_name = TransactionName::ResizeColumn;
            ops.push(Operation::ResizeRow {
                sheet_id,
                row,
                new_size: transient_resize.new_size,
                client_resized: true,
            });
        }
        self.start_user_ai_transaction(ops, cursor, transaction_name, is_ai);
    }

    pub fn commit_single_resize(
        &mut self,
        sheet_id: SheetId,
        column: Option<i32>,
        row: Option<i32>,
        size: f64,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let transient_resize = match (column, row) {
                (Some(column), None) => {
                    let old_size = sheet.offsets.column_width(column as i64);
                    TransientResize::column(column as i64, old_size, size)
                }
                (None, Some(row)) => {
                    let old_size = sheet.offsets.row_height(row as i64);
                    TransientResize::row(row as i64, old_size, size)
                }
                _ => return,
            };
            let mut ops = vec![];
            let mut transaction_name = TransactionName::Unknown;
            if let Some(column) = transient_resize.column {
                transaction_name = TransactionName::ResizeColumn;
                ops.push(Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size: transient_resize.new_size,
                    client_resized: false,
                });
            } else if let Some(row) = transient_resize.row {
                transaction_name = TransactionName::ResizeRow;
                ops.push(Operation::ResizeRow {
                    sheet_id,
                    row,
                    new_size: transient_resize.new_size,
                    client_resized: false,
                });
            }
            self.start_user_ai_transaction(ops, cursor, transaction_name, is_ai);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commit_offsets_resize() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid().first_sheet_id();
        let old_size = 100.0;
        let new_size = 200.0;

        assert_eq!(old_size, gc.grid.sheets()[0].offsets.column_width(0));

        // resize column
        let transient_resize = TransientResize {
            column: Some(0),
            row: None,
            old_size,
            new_size,
        };
        gc.commit_offsets_resize(sheet_id, transient_resize, None, false);
        assert_eq!(new_size, gc.grid.sheets()[0].offsets.column_width(0));

        // resize row
        let transient_resize = TransientResize {
            column: None,
            row: Some(0),
            old_size,
            new_size,
        };
        gc.commit_offsets_resize(sheet_id, transient_resize, None, false);
        assert_eq!(new_size, gc.grid.sheets()[0].offsets.row_height(0));
    }

    #[test]
    fn test_commit_single_resize() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid().sheets()[0].id;

        gc.commit_single_resize(sheet_id, Some(1), None, 200f64, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.column_width(1), 200f64);

        gc.commit_single_resize(sheet_id, None, Some(1), 300f64, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(1), 300f64);
    }
}
