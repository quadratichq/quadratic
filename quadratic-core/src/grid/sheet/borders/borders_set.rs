//! Functionality to set borders on a selection.

use crate::{
    controller::operations::operation::Operation, selection::Selection, RunLengthEncoding,
};

use super::{BorderStyle, BorderStyleCell, BorderStyleCellUpdate, BorderStyleCellUpdates, Borders};

impl Borders {
    /// Sets the borders for a selection.
    pub fn set_borders(
        &mut self,
        selection: &Selection,
        borders: &BorderStyleCellUpdates,
    ) -> Vec<Operation> {
        let mut undo = vec![];
        let mut undo_borders = RunLengthEncoding::new();

        if selection.all {
            let Some(border) = borders.get_at(0) else {
                panic!("Expected border style for all");
            };
            undo_borders.push(self.all.apply_update(border));
            return vec![Operation::SetBordersSelection {
                selection: selection.clone(),
                borders: undo_borders,
            }];
        }

        let mut index = 0;

        if let Some(columns) = selection.columns.as_ref() {
            for column in columns {
                let Some(border) = borders.get_at(index) else {
                    panic!("Expected a border style for column {column}");
                };
                undo.extend(self.clear_column_cells(
                    selection.sheet_id,
                    *column,
                    border.convert_to_clear(),
                ));
                if let Some(column_border) = self.columns.get_mut(column) {
                    undo_borders.push(column_border.apply_update(border));
                } else {
                    let mut new_border = BorderStyleCell::default();
                    undo_borders.push(new_border.apply_update(border));
                    self.columns.insert(*column, new_border);
                }

                index += 1;
            }
        }

        if let Some(rows) = selection.rows.as_ref() {
            for row in rows {
                let Some(border) = borders.get_at(index) else {
                    panic!("Expected a border style for row {row}");
                };
                undo.extend(self.clear_row_cells(
                    selection.sheet_id,
                    *row,
                    border.convert_to_clear(),
                ));
                if let Some(row_border) = self.rows.get_mut(row) {
                    undo_borders.push(row_border.apply_update(border));
                } else {
                    let mut new_border = BorderStyleCell::default();
                    undo_borders.push(new_border.apply_update(border));
                    self.rows.insert(*row, new_border);
                }
                index += 1;
            }
        }

        if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                rect.iter().for_each(|pos| {
                    let Some(border) = borders.get_at(index) else {
                        panic!("Expected a border style for cell {pos:?}");
                    };
                    let mut undo = BorderStyleCellUpdate::default();
                    if let Some(update_top) = border.top {
                        let top = self.top.entry(pos.y).or_default();
                        let original = top.set(pos.x, update_top);
                        undo.top = Some(original);
                    }
                    if let Some(update_bottom) = border.bottom {
                        let bottom = self.bottom.entry(pos.y).or_default();
                        let original = bottom.set(pos.x, update_bottom);
                        undo.bottom = Some(original);
                    }
                    if let Some(update_left) = border.left {
                        let left = self.left.entry(pos.x).or_default();
                        let original = left.set(pos.y, update_left);
                        undo.left = Some(original);
                    }
                    if let Some(update_right) = border.right {
                        let right = self.right.entry(pos.x).or_default();
                        let original = right.set(pos.y, update_right);
                        undo.right = Some(original);
                    }
                    undo_borders.push(undo);
                    index += 1;
                });
            }
        }

        if !undo_borders.is_empty() {
            undo.push(Operation::SetBordersSelection {
                selection: selection.clone(),
                borders: undo_borders,
            });
        }

        undo
    }

    /// Sets the border for a cell. This is used in the upgrade_border for going
    /// from v1_6 to v1_7.
    pub fn set(
        &mut self,
        x: i64,
        y: i64,
        top: Option<BorderStyle>,
        bottom: Option<BorderStyle>,
        left: Option<BorderStyle>,
        right: Option<BorderStyle>,
    ) {
        if let Some(top) = top {
            self.top.entry(y).or_default().set(x, Some(top.into()));
        }
        if let Some(bottom) = bottom {
            self.bottom
                .entry(y)
                .or_default()
                .set(x, Some(bottom.into()));
        }
        if let Some(left) = left {
            self.left.entry(x).or_default().set(y, Some(left.into()));
        }
        if let Some(right) = right {
            self.right.entry(x).or_default().set(y, Some(right.into()));
        }
    }

    pub fn apply_update(
        &mut self,
        x: i64,
        y: i64,
        update: BorderStyleCellUpdate,
    ) -> BorderStyleCellUpdate {
        let current = self.get(x, y);
        if let Some(top) = update.top {
            self.top.entry(y).or_default().set(x, top);
        }
        if let Some(bottom) = update.bottom {
            self.bottom.entry(y).or_default().set(x, bottom);
        }
        if let Some(left) = update.left {
            self.left.entry(x).or_default().set(y, left);
        }
        if let Some(right) = update.right {
            self.right.entry(x).or_default().set(y, right);
        }
        current.override_border(false)
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        color::Rgba,
        grid::{sheet::borders::CellBorderLine, SheetId},
        SheetRect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn set_borders() {
        let sheet_id = SheetId::test();
        let mut borders = Borders::default();
        let selection = Selection::sheet_rect(SheetRect::new(0, 0, 9, 9, sheet_id));
        let value = RunLengthEncoding::repeat(BorderStyleCellUpdate::all(), 10 * 10);
        borders.set_borders(&selection, &value);

        let border = borders.get(0, 0);
        assert_eq!(border.top.unwrap().line, CellBorderLine::default());
        assert_eq!(border.top.unwrap().color, Rgba::default());
        assert_eq!(border.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(border.bottom.unwrap().color, Rgba::default());
        assert_eq!(border.left.unwrap().line, CellBorderLine::default());
        assert_eq!(border.left.unwrap().color, Rgba::default());
        assert_eq!(border.right.unwrap().line, CellBorderLine::default());
        assert_eq!(border.right.unwrap().color, Rgba::default());
    }

    #[test]
    #[parallel]
    fn set_borders_erase() {
        let sheet_id = SheetId::test();
        let mut borders = Borders::default();
        let selection = Selection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id));
        let value = RunLengthEncoding::repeat(BorderStyleCellUpdate::all(), 1);
        borders.set_borders(&selection, &value);

        let border = borders.get(1, 1);
        assert!(BorderStyleCell::is_equal_ignore_timestamp(
            Some(border),
            Some(BorderStyleCell::all())
        ));

        let value = RunLengthEncoding::repeat(BorderStyleCellUpdate::clear(false), 1);
        borders.set_borders(&selection, &value);

        let border = borders.get(1, 1);
        assert!(BorderStyleCell::is_equal_ignore_timestamp(
            Some(border),
            Some(BorderStyleCell::default())
        ));
    }
}
