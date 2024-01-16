use super::{
    operations::operation::Operation, transaction_summary::TransactionSummary, GridController,
};
use crate::{grid::SheetId, sheet_offsets::resize_transient::TransientResize};

impl GridController {
    /// Commits a transient resize from a local version of SheetOffsets.
    /// see js_get_resize_to_apply
    ///
    /// Returns a [`TransactionSummary`].
    pub fn commit_offsets_resize(
        &mut self,
        sheet_id: SheetId,
        transient_resize: Option<TransientResize>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        if let Some(transient_resize) = transient_resize {
            let mut ops = vec![];
            if let Some(column) = transient_resize.column {
                ops.push(Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size: transient_resize.new_size,
                });
            } else if let Some(row) = transient_resize.row {
                ops.push(Operation::ResizeRow {
                    sheet_id,
                    row,
                    new_size: transient_resize.new_size,
                });
            }
            self.start_user_transaction(ops, cursor)
        } else {
            TransactionSummary::default()
        }
    }

    pub fn commit_single_resize(
        &mut self,
        sheet_id: SheetId,
        column: Option<i32>,
        row: Option<i32>,
        size: f64,
        cursor: Option<String>,
    ) -> TransactionSummary {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let transient_resize = match (column, row) {
                (Some(column), None) => {
                    let old_size = sheet.offsets.column_width(column as i64);
                    Some(TransientResize::column(column as i64, old_size, size))
                }
                (None, Some(row)) => {
                    let old_size = sheet.offsets.row_height(row as i64);
                    Some(TransientResize::row(row as i64, old_size, size))
                }
                _ => None,
            };
            self.commit_offsets_resize(sheet_id, transient_resize, cursor)
        } else {
            TransactionSummary::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commit_offsets_resize() {
        let mut gc = GridController::test();
        let sheet = &mut gc.grid_mut().sheets_mut()[0];
        let sheet_id = sheet.id;
        let old_size = 100.0;
        let new_size = 200.0;

        assert_eq!(old_size, gc.grid.sheets()[0].offsets.column_width(0));

        // resize nothing
        gc.commit_offsets_resize(sheet_id, None, None);
        assert_eq!(old_size, gc.grid.sheets()[0].offsets.column_width(0));

        // resize column
        let transient_resize = TransientResize {
            column: Some(0),
            row: None,
            old_size,
            new_size,
        };
        gc.commit_offsets_resize(sheet_id, Some(transient_resize), None);
        assert_eq!(new_size, gc.grid.sheets()[0].offsets.column_width(0));

        // resize row
        let transient_resize = TransientResize {
            column: None,
            row: Some(0),
            old_size,
            new_size,
        };
        gc.commit_offsets_resize(sheet_id, Some(transient_resize), None);
        assert_eq!(new_size, gc.grid.sheets()[0].offsets.row_height(0));
    }

    #[test]
    fn test_commit_single_resize() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid().sheets()[0].id;

        gc.commit_single_resize(sheet_id, Some(1), None, 200f64, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.column_width(1), 200f64);

        gc.commit_single_resize(sheet_id, None, Some(1), 300f64, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(1), 300f64);
    }
}
