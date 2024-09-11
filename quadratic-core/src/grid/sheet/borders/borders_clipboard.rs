use crate::{controller::operations::operation::Operation, grid::SheetId, selection::Selection};

use super::{BorderStyleCell, BorderStyleCellUpdates, Borders};

impl Borders {
    /// Prepares borders within the selection for copying to the clipboard.
    ///
    /// Returns `None` if there are no borders to copy.
    pub fn to_clipboard(&self, selection: &Selection) -> Option<BorderStyleCellUpdates> {
        let mut updates = BorderStyleCellUpdates::default();

        if selection.all {
            updates.push(self.all.override_border(false));
        }
        if let Some(column) = selection.columns.as_ref() {
            for col in column {
                if let Some(border_col) = self.columns.get(col) {
                    updates.push(border_col.override_border(false));
                } else {
                    updates.push(BorderStyleCell::clear());
                }
            }
        }
        if let Some(row) = selection.rows.as_ref() {
            for row in row {
                if let Some(border_row) = self.rows.get(row) {
                    updates.push(border_row.override_border(false));
                } else {
                    updates.push(BorderStyleCell::clear());
                }
            }
        }
        if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                for row in rect.min.y..=rect.max.y {
                    for col in rect.min.x..=rect.max.x {
                        updates.push(self.get_update_override(col, row));
                    }
                }
            }
        }
        if updates.is_empty() {
            None
        } else {
            Some(updates)
        }
    }

    /// Gets an operation to recreate the column's borders.
    pub fn get_column_ops(&self, sheet_id: SheetId, column: i64) -> Vec<Operation> {
        let mut borders = BorderStyleCellUpdates::default();
        let mut selection = Selection::new(sheet_id);
        if self.columns.contains_key(&column) {
            selection.columns = Some(vec![column]);
            borders.push(self.columns[&column].override_border(false));
        }

        if let Some(bounds) = self.bounds_column(column, false, false) {
            dbg!(&bounds);
            for row in bounds.min.y..=bounds.max.y {
                let border = self.get(column, row).override_border(false);
                borders.push(border);
            }
            selection.rects = Some(vec![bounds]);
        }

        if selection.is_empty() {
            vec![]
        } else {
            vec![Operation::SetBordersSelection { selection, borders }]
        }
    }

    /// Gets an operation to recreate the row's borders.
    pub fn get_row_ops(&self, sheet_id: SheetId, row: i64) -> Vec<Operation> {
        let mut borders = BorderStyleCellUpdates::default();
        let mut selection = Selection::new(sheet_id);
        if self.rows.contains_key(&row) {
            selection.rows = Some(vec![row]);
            borders.push(self.rows[&row].override_border(false));
        }

        if let Some(bounds) = self.bounds_row(row, false, false) {
            for col in bounds.min.x..=bounds.max.x {
                let border = self.get(col, row).override_border(false);
                borders.push(border);
            }
            selection.rects = Some(vec![bounds]);
        }

        if selection.is_empty() {
            vec![]
        } else {
            vec![Operation::SetBordersSelection { selection, borders }]
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;
    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{
            sheet::borders::BorderStyleCellUpdate, BorderSelection, BorderStyle, CellBorderLine,
        },
        Rect, SheetRect,
    };

    #[test]
    #[parallel]
    fn to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(crate::SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let clipboard = gc
            .sheet(sheet_id)
            .borders
            .to_clipboard(&Selection::sheet_rect(crate::SheetRect::new(
                0, 0, 3, 3, sheet_id,
            )))
            .unwrap();

        let entry = clipboard.get_at(6).unwrap();
        assert_eq!(entry.top.unwrap().unwrap().line, CellBorderLine::default());
        assert_eq!(entry.top.unwrap().unwrap().color, Rgba::default());
        assert_eq!(entry.left.unwrap().unwrap().line, CellBorderLine::default());
        assert_eq!(entry.left.unwrap().unwrap().color, Rgba::default());
        assert_eq!(
            entry.bottom.unwrap().unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(entry.bottom.unwrap().unwrap().color, Rgba::default());
        assert_eq!(
            entry.right.unwrap().unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(entry.right.unwrap().unwrap().color, Rgba::default());
    }

    #[test]
    #[parallel]
    fn get_column_ops() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let ops = sheet.borders.get_column_ops(sheet_id, 1);
        assert_eq!(ops.len(), 1);

        let mut selection = Selection::default();
        selection.sheet_id = sheet_id;
        selection.rects = Some(vec![Rect::new(1, 1, 1, 2)]);
        assert_eq!(
            ops[0],
            Operation::SetBordersSelection {
                selection,
                borders: BorderStyleCellUpdates::repeat(BorderStyleCellUpdate::all(), 2),
            }
        );
    }

    #[test]
    #[parallel]
    fn get_row_ops() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let ops = sheet.borders.get_row_ops(sheet_id, 1);
        assert_eq!(ops.len(), 1);

        let mut selection = Selection::default();
        selection.sheet_id = sheet_id;
        selection.rects = Some(vec![Rect::new(1, 1, 2, 1)]);
        assert_eq!(
            ops[0],
            Operation::SetBordersSelection {
                selection,
                borders: BorderStyleCellUpdates::repeat(BorderStyleCellUpdate::all(), 2),
            }
        );
    }
}
