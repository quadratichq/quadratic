use crate::grid::resize::Resize;

use super::Sheet;

impl Sheet {
    pub fn get_row_resize(&self, row: i64) -> Resize {
        self.rows_resize.get_resize(row)
    }

    pub fn set_row_resize(&mut self, row: i64, value: Resize) -> Resize {
        self.rows_resize.set_resize(row, value)
    }

    pub fn iter_row_resize(&self) -> impl '_ + Iterator<Item = (i64, Resize)> {
        self.rows_resize.iter_resize()
    }

    // return old_client_resized
    pub fn update_row_resize(&mut self, row: i64, client_resized: bool) -> bool {
        let resize = if client_resized {
            Resize::Manual
        } else {
            Resize::Auto
        };
        let old_resize = self.set_row_resize(row, resize);
        old_resize == Resize::Manual
    }

    pub fn get_auto_resize_rows(&self, rows: Vec<i64>) -> Vec<i64> {
        rows.into_iter()
            .filter(|&row| self.get_row_resize(row) == Resize::Auto)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        Pos, Rect, controller::GridController, grid::resize::Resize,
        sheet_offsets::resize_transient::TransientResize,
    };

    #[test]
    fn test_get_row_resize_default() {
        let sheet = Sheet::test();
        assert_eq!(sheet.get_row_resize(0), Resize::Auto);
        assert_eq!(sheet.get_row_resize(10), Resize::Auto);
        assert_eq!(sheet.get_row_resize(-1), Resize::Auto);
    }

    #[test]
    fn test_get_row_resize_custom() {
        let mut sheet = Sheet::test();
        sheet.set_row_resize(5, Resize::Manual);

        assert_eq!(sheet.get_row_resize(5), Resize::Manual);
        assert_eq!(sheet.get_row_resize(0), Resize::Auto);
        assert_eq!(sheet.get_row_resize(10), Resize::Auto);
    }

    #[test]
    fn test_get_row_resize_multiple() {
        let mut sheet = Sheet::test();
        sheet.set_row_resize(3, Resize::Manual);
        sheet.set_row_resize(7, Resize::Manual);

        assert_eq!(sheet.get_row_resize(3), Resize::Manual);
        assert_eq!(sheet.get_row_resize(7), Resize::Manual);
        assert_eq!(sheet.get_row_resize(5), Resize::Auto);
    }

    #[test]
    fn test_set_row_resize() {
        let mut sheet = Sheet::test();

        // Test setting resize to Manual
        let old_resize = sheet.set_row_resize(5, Resize::Manual);
        assert_eq!(old_resize, Resize::Auto);
        assert_eq!(sheet.get_row_resize(5), Resize::Manual);

        // Test setting resize to Auto
        let old_resize = sheet.set_row_resize(5, Resize::Auto);
        assert_eq!(old_resize, Resize::Manual);
        assert_eq!(sheet.get_row_resize(5), Resize::Auto);

        // Test setting resize for a different row
        sheet.set_row_resize(10, Resize::Manual);
        assert_eq!(sheet.get_row_resize(10), Resize::Manual);
        assert_eq!(sheet.get_row_resize(5), Resize::Auto);

        // Test setting resize for a negative row number
        sheet.set_row_resize(-1, Resize::Manual);
        assert_eq!(sheet.get_row_resize(-1), Resize::Manual);

        // Test setting resize to the same value
        let old_resize = sheet.set_row_resize(10, Resize::Manual);
        assert_eq!(old_resize, Resize::Manual);
        assert_eq!(sheet.get_row_resize(10), Resize::Manual);
    }

    #[test]
    fn test_set_row_resize_interaction_with_other_methods() {
        let mut sheet = Sheet::test();

        // Set resize using set_row_resize
        sheet.set_row_resize(3, Resize::Manual);
        sheet.set_row_resize(7, Resize::Manual);

        // Test interaction with iter_row_resize
        let mut resizes: Vec<(i64, Resize)> = sheet.iter_row_resize().collect();
        resizes.sort_by_key(|&(k, _)| k);
        assert_eq!(resizes, vec![(3, Resize::Manual), (7, Resize::Manual)]);

        // Test interaction with update_row_resize
        let old_client_resize = sheet.update_row_resize(3, false);
        assert!(old_client_resize);
        assert_eq!(sheet.get_row_resize(3), Resize::Auto);

        // Test interaction with get_auto_resize_rows
        let auto_rows = sheet.get_auto_resize_rows(vec![1, 2, 3, 4, 5, 6, 7, 8]);
        assert_eq!(auto_rows, vec![1, 2, 3, 4, 5, 6, 8]);
    }

    #[test]
    fn test_set_and_reset_row_resize() {
        let mut sheet = Sheet::test();

        // Set resize to Manual
        sheet.set_row_resize(5, Resize::Manual);
        assert_eq!(sheet.get_row_resize(5), Resize::Manual);

        // Reset resize
        sheet.rows_resize.reset(5);
        assert_eq!(sheet.get_row_resize(5), Resize::Auto);
    }

    #[test]
    fn test_iter_row_resize_empty() {
        let sheet = Sheet::test();
        let resizes: Vec<(i64, Resize)> = sheet.iter_row_resize().collect();
        assert!(resizes.is_empty());
    }

    #[test]
    fn test_iter_row_resize_multiple() {
        let mut sheet = Sheet::test();
        sheet.set_row_resize(3, Resize::Manual);
        sheet.set_row_resize(7, Resize::Manual);

        let mut resizes: Vec<(i64, Resize)> = sheet.iter_row_resize().collect();
        resizes.sort_by_key(|&(k, _)| k); // Sort by key for consistent ordering
        assert_eq!(resizes, vec![(3, Resize::Manual), (7, Resize::Manual)]);
    }

    #[test]
    fn test_update_row_resize() {
        let mut sheet = Sheet::test();
        let row = 1;

        // update row resize
        let old_client_resize = sheet.update_row_resize(row, true);
        assert!(!old_client_resize);
        // check if row is auto resized
        let auto_resized = sheet.get_row_resize(row);
        assert_eq!(auto_resized, Resize::Manual);

        // update row resize
        let old_client_resize = sheet.update_row_resize(row, false);
        assert!(old_client_resize);
        // check if row is auto resized
        let auto_resized = sheet.get_row_resize(row);
        assert_eq!(auto_resized, Resize::Auto);
    }

    #[test]
    fn test_get_auto_resize_rows() {
        let mut sheet = Sheet::test();
        let view_rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 4 });
        let sheet_rect = view_rect.to_sheet_rect(sheet.id);

        // all rows should be auto resized by default
        let rows = sheet.get_auto_resize_rows(sheet_rect.y_range().collect());
        assert_eq!(rows, vec![1, 2, 3, 4]);

        // update row resize
        sheet.update_row_resize(1, true);
        sheet.update_row_resize(2, true);
        // check new auto resized rows
        let rows = sheet.get_auto_resize_rows(sheet_rect.y_range().collect());
        assert_eq!(rows, vec![3, 4]);

        // update row resize
        sheet.update_row_resize(1, false);
        // check new auto resized rows
        let rows = sheet.get_auto_resize_rows(sheet_rect.y_range().collect());
        assert_eq!(rows, vec![1, 3, 4]);

        // update all rows to manual resize
        sheet.update_row_resize(1, true);
        sheet.update_row_resize(3, true);
        sheet.update_row_resize(4, true);
        // check new auto resized rows should be None
        let rows = sheet.get_auto_resize_rows(sheet_rect.y_range().collect());
        assert!(rows.is_empty());
    }

    #[test]
    fn test_convert_to_manual_resize_on_commit_offsets_resize() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid().sheets()[0].id;
        let old_size = 100.0;
        let new_size = 200.0;

        // resize column, should not change row resize
        let transient_resize = TransientResize {
            column: Some(0),
            row: None,
            old_size,
            new_size,
        };
        gc.commit_offsets_resize(sheet_id, transient_resize, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.column_width(0), new_size);
        assert_eq!(Resize::Auto, sheet.get_row_resize(0));
        assert_eq!(Resize::Auto, sheet.get_row_resize(1));

        // resize row, should change row resize to Manual
        let transient_resize = TransientResize {
            column: None,
            row: Some(0),
            old_size,
            new_size,
        };
        gc.commit_offsets_resize(sheet_id, transient_resize, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(0), new_size);
        assert_eq!(Resize::Manual, sheet.get_row_resize(0));
        assert_eq!(Resize::Auto, sheet.get_row_resize(1));
    }

    #[test]
    fn test_convert_to_auto_resize_on_commit_single_resize() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid().sheets()[0].id;
        let old_size = 100.0;
        let new_size = 200.0;

        // resize row, should change row resize to Manual
        let transient_resize = TransientResize {
            column: None,
            row: Some(0),
            old_size,
            new_size,
        };
        gc.commit_offsets_resize(sheet_id, transient_resize, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(0), 200f64);
        assert_eq!(Resize::Manual, sheet.get_row_resize(0));
        assert_eq!(Resize::Auto, sheet.get_row_resize(1));

        // resize column, should change row resize to Auto
        gc.commit_single_resize(sheet_id, None, Some(0), 300f64, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(0), 300f64);
        assert_eq!(Resize::Auto, sheet.get_row_resize(0));
        assert_eq!(Resize::Auto, sheet.get_row_resize(1));
    }
}
