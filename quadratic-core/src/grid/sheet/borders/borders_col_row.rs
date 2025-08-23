//! Inserts and removes columns and rows for borders. Also provides fn to get
//! undo operations for these changes.

use crate::CopyFormats;

use super::{Borders, BordersType, BordersUpdates, BordersUpdatesType};

impl Borders {
    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
        self.left.insert_column(column, copy_formats);
        self.right.insert_column(column, copy_formats);
        self.top.insert_column(column, copy_formats);
        self.bottom.insert_column(column, copy_formats);
    }

    pub fn remove_column(&mut self, column: i64) -> BordersUpdates {
        let remove_column_item = |item: &mut BordersType| -> BordersUpdatesType {
            item.remove_column(column)
                .map(|c| c.map_ref(|c| c.map(Into::into)))
        };

        BordersUpdates {
            left: remove_column_item(&mut self.left),
            right: remove_column_item(&mut self.right),
            top: remove_column_item(&mut self.top),
            bottom: remove_column_item(&mut self.bottom),
        }
    }

    pub fn copy_column(&self, column: i64) -> Option<BordersUpdates> {
        let copy_column_item = |item: &BordersType| -> BordersUpdatesType {
            item.copy_column(column)
                .map(|c| c.map_ref(|c| c.map(Into::into)))
        };

        let updates = BordersUpdates {
            left: copy_column_item(&self.left),
            right: copy_column_item(&self.right),
            top: copy_column_item(&self.top),
            bottom: copy_column_item(&self.bottom),
        };

        if updates.is_empty() {
            None
        } else {
            Some(updates)
        }
    }

    pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
        self.left.insert_row(row, copy_formats);
        self.right.insert_row(row, copy_formats);
        self.top.insert_row(row, copy_formats);
        self.bottom.insert_row(row, copy_formats);
    }

    pub fn remove_row(&mut self, row: i64) -> BordersUpdates {
        let remove_row_item = |item: &mut BordersType| -> BordersUpdatesType {
            item.remove_row(row)
                .map(|c| c.map_ref(|c| c.map(Into::into)))
        };

        BordersUpdates {
            left: remove_row_item(&mut self.left),
            right: remove_row_item(&mut self.right),
            top: remove_row_item(&mut self.top),
            bottom: remove_row_item(&mut self.bottom),
        }
    }

    pub fn copy_row(&self, row: i64) -> Option<BordersUpdates> {
        let copy_row_item = |item: &BordersType| -> BordersUpdatesType {
            item.copy_row(row).map(|c| c.map_ref(|c| c.map(Into::into)))
        };

        let updates = BordersUpdates {
            left: copy_row_item(&self.left),
            right: copy_row_item(&self.right),
            top: copy_row_item(&self.top),
            bottom: copy_row_item(&self.bottom),
        };

        if updates.is_empty() {
            None
        } else {
            Some(updates)
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, CopyFormats,
        a1::A1Selection,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle, Borders},
    };

    #[test]
    fn insert_column_empty() {
        let mut borders = Borders::default();
        borders.insert_column(1, CopyFormats::None);
        assert!(borders.is_default());
    }

    #[test]
    fn delete_column_empty() {
        let mut borders = Borders::default();
        borders.remove_column(1);
        assert!(borders.is_default());
    }

    #[test]
    fn insert_column_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_column(1, CopyFormats::None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("B1:K10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn insert_column_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_column(5, CopyFormats::None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:D10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        gc_expected.set_borders(
            A1Selection::test_a1("F1:K10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn insert_column_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_column(11, CopyFormats::None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn remove_column_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_column(1);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:I10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn remove_column_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_column(5);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:I10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn remove_column_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_column(10);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:I10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn insert_row_empty() {
        let mut borders = Borders::default();
        borders.insert_row(0, CopyFormats::None);
        assert!(borders.is_default());
    }

    #[test]
    fn insert_row_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_row(1, CopyFormats::None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A2:J11"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn insert_row_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_row(5, CopyFormats::None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J4"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        gc_expected.set_borders(
            A1Selection::test_a1("A6:J11"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn test_insert_row_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J4"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_row(11, CopyFormats::None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J4"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn remove_row_empty() {
        let mut borders = Borders::default();
        borders.remove_row(0);
        assert!(borders.is_default());
    }

    #[test]
    fn remove_row_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_row(1);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J9"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn remove_row_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_row(5);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J9"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn remove_row_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_row(10);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J9"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn delete_row_undo_code() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            pos![A1].to_sheet_pos(sheet_id),
            "12".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![A2].to_sheet_pos(sheet_id),
            "34".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![A3].to_sheet_pos(sheet_id),
            "56".to_string(),
            None,
            false,
        );

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.delete_rows(sheet_id, vec![2], None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(56.into()))
        );
        assert_eq!(sheet.display_value(pos![A3]), None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J9"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));

        // this will reinsert the row
        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(34.into()))
        );
        assert_eq!(
            sheet.display_value(pos![A3]),
            Some(CellValue::Number(56.into()))
        );

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }

    #[test]
    fn insert_row_undo_code() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            pos![A1].to_sheet_pos(sheet_id),
            "12".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![A2].to_sheet_pos(sheet_id),
            "34".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![A3].to_sheet_pos(sheet_id),
            "56".to_string(),
            None,
            false,
        );

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.insert_rows(sheet_id, 2, 1, true, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(sheet.display_value(pos![A2]), None);
        assert_eq!(
            sheet.display_value(pos![A3]),
            Some(CellValue::Number(34.into()))
        );
        assert_eq!(
            sheet.display_value(pos![A4]),
            Some(CellValue::Number(56.into()))
        );
        assert_eq!(sheet.display_value(pos![A5]), None);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J11"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders,
        ));

        // this will remove the inserted row
        gc.undo(None);

        let sheet = gc.sheet(sheet_id);

        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(34.into()))
        );
        assert_eq!(
            sheet.display_value(pos![A3]),
            Some(CellValue::Number(56.into()))
        );

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert!(Borders::compare_borders(
            &sheet.borders,
            &sheet_expected.borders
        ));
    }
}
