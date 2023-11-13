use crate::{grid::SheetId, sheet_offsets::resize_transient::TransientResize};

use super::{
    operation::Operation, transaction_summary::TransactionSummary, transactions::TransactionType,
    GridController,
};

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
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        if let Some(transient_resize) = transient_resize {
            let mut ops = vec![];
            if let Some(column) = transient_resize.column {
                let (column, _) = sheet.get_or_create_column(column);
                ops.push(Operation::ResizeColumn {
                    sheet_id,
                    column: column.id,
                    new_size: transient_resize.new_size,
                });
            } else if let Some(row) = transient_resize.row {
                let row = sheet.get_or_create_row(row);
                ops.push(Operation::ResizeRow {
                    sheet_id,
                    row: row.id,
                    new_size: transient_resize.new_size,
                });
            }
            self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
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
        let mut gc = GridController::new();
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
}
