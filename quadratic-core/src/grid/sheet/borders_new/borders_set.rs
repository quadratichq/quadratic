use crate::{
    controller::operations::operation::Operation, grid::ColumnData, selection::Selection,
    RunLengthEncoding,
};

use super::{
    borders_style::{BorderStyleCell, BorderStyleCellUpdate},
    Borders,
};

impl Borders {
    /// Sets the borders for a selection.
    pub fn set_borders(
        &mut self,
        selection: Selection,
        borders: RunLengthEncoding<BorderStyleCellUpdate>,
    ) -> Vec<Operation> {
        let mut undo_borders = RunLengthEncoding::new();

        if selection.all {
            let Some(border) = borders.get_at(0) else {
                panic!("Expected 1 border style for all");
            };
            undo_borders.push(self.all.apply_update(border));
            return vec![Operation::SetBordersSelection {
                selection,
                borders: undo_borders,
            }];
        }

        let mut index = 0;

        if let Some(columns) = selection.columns.as_ref() {
            for column in columns {
                let Some(border) = borders.get_at(index) else {
                    panic!("Expected a border style for column {column}");
                };
                if let Some(column_border) = self.columns.get_mut(&column) {
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
                if let Some(row_border) = self.rows.get_mut(&row) {
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
                        let top = self.top.entry(pos.y).or_insert_with(ColumnData::new);
                        let original = top.set(pos.x, update_top);
                        undo.top = Some(original);
                    }
                    if let Some(update_bottom) = border.bottom {
                        let bottom = self.bottom.entry(pos.y).or_insert_with(ColumnData::new);
                        let original = bottom.set(pos.x, update_bottom);
                        undo.bottom = Some(original);
                    }
                    if let Some(update_left) = border.left {
                        let left = self.left.entry(pos.y).or_insert_with(ColumnData::new);
                        let original = left.set(pos.x, update_left);
                        undo.left = Some(original);
                    }
                    if let Some(update_right) = border.right {
                        let right = self.right.entry(pos.y).or_insert_with(ColumnData::new);
                        let original = right.set(pos.x, update_right);
                        undo.right = Some(original);
                    }
                    undo_borders.push(undo);
                    index += 1;
                })
            }
        }

        if !undo_borders.is_empty() {
            vec![Operation::SetBordersSelection {
                selection,
                borders: undo_borders,
            }]
        } else {
            vec![]
        }
    }
}
