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

        if let Some(bounds) =
            self.bounds_column(column, update.left.is_some(), update.right.is_some())
        {
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

            // push undo operations
            undo_ops.push(Operation::SetBordersSelection {
                selection: Selection::sheet_rect(bounds.to_sheet_rect(sheet_id)),
                borders,
            });
        }
        undo_ops
    }

    // Clears any cell borders for a row change.
    //
    // This is used whenever borders are set on a row. Any cells with borders
    // in that row that overlap this setting need to be cleared.
    //
    // Returns the undo operations.
    pub fn clear_row_cells(
        &mut self,
        sheet_id: SheetId,
        row: i64,
        update: BorderStyleCellUpdate,
    ) -> Vec<Operation> {
        let mut undo_ops = Vec::new();

        if let Some(bounds) = self.bounds_row(row, update.top.is_some(), update.bottom.is_some()) {
            let mut borders = BorderStyleCellUpdates::default();

            for c in bounds.min.x..=bounds.max.x {
                for r in bounds.min.y..=bounds.max.y {
                    if let Some(border) = self.try_get(c, r) {
                        // clear the entire row
                        if r == row {
                            self.apply_update(c, r, update);
                            borders.push(border);
                        }
                        // clear the top row for bottom entries
                        else if r == row - 1 {
                            // we only clear if the update left is set (since
                            // we're clearing the right of the current column)
                            if update.top.is_some() {
                                let original = self.apply_update(
                                    c,
                                    r,
                                    BorderStyleCellUpdate {
                                        bottom: Some(None),
                                        ..Default::default()
                                    },
                                );
                                borders.push(original);
                            } else {
                                borders.push(BorderStyleCellUpdate::default());
                            }
                        }
                        // clear the bottom row for top entries
                        else if r == row + 1 {
                            // we only clear if the update right is set (since
                            // we're clearing the left of the next column)
                            if update.bottom.is_some() {
                                let original = self.apply_update(
                                    c,
                                    r,
                                    BorderStyleCellUpdate {
                                        top: Some(None),
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

            // push undo operations
            undo_ops.push(Operation::SetBordersSelection {
                selection: Selection::sheet_rect(bounds.to_sheet_rect(sheet_id)),
                borders,
            });
        }
        undo_ops
    }

    // Clears any cell borders for a row change.
    //
    // This is used whenever borders are set on a row. Any cells with borders
    // in that row that overlap this setting need to be cleared.
    //
    // Returns the undo operations.
    pub fn clear_all_cells(
        &mut self,
        sheet_id: SheetId,
        update: BorderStyleCellUpdate,
    ) -> Vec<Operation> {
        let mut undo_ops = Vec::new();
        let mut undo_selection = Selection::default();
        let mut borders = BorderStyleCellUpdates::default();

        if !self.columns.is_empty() {
            undo_selection.columns = Some(self.columns.keys().cloned().collect::<Vec<_>>());
            self.columns
                .iter()
                .for_each(|(_, cell)| borders.push(cell.override_border(false)));
            self.columns.clear();
        }

        if !self.rows.is_empty() {
            undo_selection.rows = Some(self.rows.keys().cloned().collect::<Vec<_>>());
            self.rows
                .iter()
                .for_each(|(_, cell)| borders.push(cell.override_border(false)));
            self.rows.clear();
        }

        if let Some(bounds) = self.bounds() {
            undo_selection.rects = Some(vec![bounds]);
            for c in bounds.min.x..=bounds.max.x {
                for r in bounds.min.y..=bounds.max.y {
                    if let Some(border) = self.try_get(c, r) {
                        self.apply_update(c, r, update);
                        borders.push(border);
                    }
                }
            }

            // push undo operations
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
    #[test]
    #[parallel]
    fn clear_row_top() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse = sheet.borders.clear_row_cells(
            sheet_id,
            1,
            BorderStyleCellUpdate {
                top: Some(None),
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
                JsBorderHorizontal::new_test(1, 2, 2),
                JsBorderHorizontal::new_test(1, 3, 2)
            ])
        );
        assert_eq!(
            vertical,
            Some(vec![
                JsBorderVertical::new_test(1, 1, 2),
                JsBorderVertical::new_test(2, 1, 2),
                JsBorderVertical::new_test(3, 1, 2)
            ])
        );
    }

    #[test]
    #[parallel]
    fn clear_row_bottom() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse = sheet.borders.clear_row_cells(
            sheet_id,
            2,
            BorderStyleCellUpdate {
                bottom: Some(None),
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
                JsBorderVertical::new_test(1, 1, 2),
                JsBorderVertical::new_test(2, 1, 2),
                JsBorderVertical::new_test(3, 1, 2)
            ])
        );
    }

    #[test]
    #[parallel]
    fn clear_row_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse =
            sheet
                .borders
                .clear_row_cells(sheet_id, 1, BorderStyleCellUpdate::clear(false));
        assert_eq!(reverse.len(), 1);

        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders.bounds().unwrap();
        let horizontal = sheet.borders.horizontal_borders_in_rect(bounds);
        let vertical = sheet.borders.vertical_borders_in_rect(bounds);
        assert_eq!(
            horizontal,
            Some(vec![JsBorderHorizontal::new_test(1, 3, 2)])
        );
        assert_eq!(
            vertical,
            Some(vec![
                JsBorderVertical::new_test(1, 2, 1),
                JsBorderVertical::new_test(2, 2, 1),
                JsBorderVertical::new_test(3, 2, 1)
            ])
        );
    }

    #[test]
    #[parallel]
    fn clear_all_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let reverse = sheet
            .borders
            .clear_all_cells(sheet_id, BorderStyleCellUpdate::clear(false));
        assert_eq!(reverse.len(), 1);

        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders.bounds().unwrap();
        let horizontal = sheet.borders.horizontal_borders_in_rect(bounds);
        let vertical = sheet.borders.vertical_borders_in_rect(bounds);
        assert_eq!(horizontal, None);
        assert_eq!(vertical, None);
    }
}
