#[cfg(test)]
mod tests {
    use crate::controller::GridController;

    // also see tests in sheet_offsets.rs

    #[test]
    fn test_execute_operation_resize_column() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let column = 0;
        let new_size = 100.0;
        let summary = gc.commit_single_resize(sheet_id, Some(column), None, new_size, None);
        let column_width = gc
            .grid
            .try_sheet_from_id(sheet_id)
            .unwrap()
            .offsets
            .column_width(column as i64);
        assert_eq!(column_width, new_size);
        assert_eq!(summary.save, true);
        assert_eq!(summary.offsets_modified.len(), 1);
        assert_eq!(summary.offsets_modified, vec![sheet_id]);
    }

    #[test]
    fn test_execute_operation_resize_row() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let row = 0;
        let new_size = 100.0;
        let summary = gc.commit_single_resize(sheet_id, None, Some(row), new_size, None);
        let row_height = gc
            .grid
            .try_sheet_from_id(sheet_id)
            .unwrap()
            .offsets
            .row_height(row as i64);
        assert_eq!(row_height, new_size);
        assert_eq!(summary.save, true);
        assert_eq!(summary.offsets_modified.len(), 1);
        assert_eq!(summary.offsets_modified, vec![sheet_id]);
    }
}
