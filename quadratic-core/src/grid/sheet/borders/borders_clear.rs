//! Functionality to clear cell borders when columns, rows, and all are set.

use crate::{controller::operations::operation::Operation, grid::SheetId, selection::Selection};

use super::{BorderStyleCellUpdate, BorderStyleCellUpdates, Borders};

impl Borders {
    // Clears any cell borders for a column change.
    //
    // This is used whenever borders are set on a column. Any cells with borders
    // in that column that overlap this setting need to be cleared.
    //
    // Returns the undo operations.
    pub fn clear_column_cells(
        &mut self,
        sheet_id: SheetId,
        column: i64,
        update: BorderStyleCellUpdate,
    ) -> Vec<Operation> {
        let mut undo_ops = Vec::new();

        if let Some(bounds) = self.bounds_column(column) {
            let mut borders = BorderStyleCellUpdates::default();

            for r in bounds.min.y..=bounds.max.y {
                for c in bounds.min.x..=bounds.max.x {
                    if let Some(border) = self.try_get(c, r) {
                        // clear the entire column
                        if c == column {
                            self.apply_update(c, r, update);
                            borders.push(border);
                        }
                        // clear the left column for right entries
                        else if c == column - 1 {
                            // we only clear if the update left is set (since
                            // we're clearing the right of the current column)
                            if update.left.is_some() {
                                let original = self.apply_update(
                                    c,
                                    r,
                                    BorderStyleCellUpdate {
                                        right: Some(None),
                                        ..Default::default()
                                    },
                                );
                                borders.push(original);
                            } else {
                                borders.push(BorderStyleCellUpdate::default());
                            }
                        }
                        // clear the right column for left entries
                        else if c == column + 1 {
                            // we only clear if the update right is set (since
                            // we're clearing the left of the next column)
                            if update.right.is_some() {
                                let original = self.apply_update(
                                    c,
                                    r,
                                    BorderStyleCellUpdate {
                                        left: Some(None),
                                        ..Default::default()
                                    },
                                );
                                borders.push(original);
                            } else {
                                borders.push(BorderStyleCellUpdate::default());
                            }
                        }
                    } else {
                        borders.push(BorderStyleCellUpdate::default());
                    }
                }
            }

            // push any undo operations
            undo_ops.push(Operation::SetBordersSelection {
                selection: Selection::sheet_rect(bounds.to_sheet_rect(sheet_id)),
                borders,
            });
        }
        undo_ops
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        controller::GridController,
        grid::{
            sheet::borders::{BorderStyleCellUpdate, JsBorderHorizontal, JsBorderVertical},
            BorderSelection, BorderStyle,
        },
        selection::Selection,
        SheetRect,
    };

    #[test]
    #[parallel]
    fn clear_column_only_column() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(2, 2, 2, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse =
            sheet
                .borders
                .clear_column_cells(sheet_id, 2, BorderStyleCellUpdate::clear(false));
        assert_eq!(reverse.len(), 1);

        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders.bounds().unwrap();
        let horizontal = sheet.borders.horizontal_borders_in_rect(bounds);
        let vertical = sheet.borders.vertical_borders_in_rect(bounds);
        assert_eq!(horizontal, None);
        assert_eq!(vertical, None);
    }

    #[test]
    #[parallel]
    fn clear_column_neighbors() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 3, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse =
            sheet
                .borders
                .clear_column_cells(sheet_id, 2, BorderStyleCellUpdate::clear(false));
        assert_eq!(reverse.len(), 1);

        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders.bounds().unwrap();
        let horizontal = sheet.borders.horizontal_borders_in_rect(bounds);
        let vertical = sheet.borders.vertical_borders_in_rect(bounds);
        assert_eq!(
            horizontal,
            Some(vec![
                JsBorderHorizontal::new_test(1, 1, 1),
                JsBorderHorizontal::new_test(3, 1, 1),
                JsBorderHorizontal::new_test(1, 2, 1),
                JsBorderHorizontal::new_test(3, 2, 1)
            ])
        );
        assert_eq!(
            vertical,
            Some(vec![
                JsBorderVertical::new_test(1, 1, 1),
                JsBorderVertical::new_test(4, 1, 1)
            ])
        );
    }

    #[test]
    #[parallel]
    fn set_column_left() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse = sheet.borders.clear_column_cells(
            sheet_id,
            2,
            BorderStyleCellUpdate {
                left: Some(None),
                ..Default::default()
            },
        );
        assert_eq!(reverse.len(), 1);

        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders.bounds().unwrap();
        let horizontal = sheet.borders.horizontal_borders_in_rect(bounds);
        let vertical = sheet.borders.vertical_borders_in_rect(bounds);
        assert_eq!(
            horizontal,
            Some(vec![
                JsBorderHorizontal::new_test(1, 1, 2),
                JsBorderHorizontal::new_test(1, 2, 2)
            ])
        );
        assert_eq!(
            vertical,
            Some(vec![
                JsBorderVertical::new_test(1, 1, 1),
                JsBorderVertical::new_test(3, 1, 1)
            ])
        );
    }

    #[test]
    #[parallel]
    fn set_column_right() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse = sheet.borders.clear_column_cells(
            sheet_id,
            1,
            BorderStyleCellUpdate {
                right: Some(None),
                ..Default::default()
            },
        );
        assert_eq!(reverse.len(), 1);

        let sheet = gc.sheet(sheet_id);

        sheet.borders.print_borders();

        let bounds = sheet.borders.bounds().unwrap();
        let horizontal = sheet.borders.horizontal_borders_in_rect(bounds);
        let vertical = sheet.borders.vertical_borders_in_rect(bounds);
        assert_eq!(
            horizontal,
            Some(vec![
                JsBorderHorizontal::new_test(1, 1, 2),
                JsBorderHorizontal::new_test(1, 2, 2)
            ])
        );
        assert_eq!(
            vertical,
            Some(vec![
                JsBorderVertical::new_test(1, 1, 1),
                JsBorderVertical::new_test(3, 1, 1)
            ])
        );
    }
}
