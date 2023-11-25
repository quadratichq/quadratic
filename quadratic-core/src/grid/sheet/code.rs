use std::{collections::HashSet, ops::Range};

use super::Sheet;
use crate::{grid::CodeCellValue, CellValue, Pos, Rect, SheetPos, Value};

impl Sheet {
    /// Sets or deletes a code cell value and populates spills.
    pub fn set_code_cell_value(
        &mut self,
        pos: Pos,
        code_cell: Option<CodeCellValue>,
    ) -> Option<CodeCellValue> {
        let sheet_id = self.id;
        let old = self.code_cells.remove(&pos);
        if let Some(code_cell) = code_cell {
            if let Some(output) = code_cell.output.clone() {
                match output.output_value() {
                    Some(output_value) => match output_value {
                        Value::Single(_) => {
                            let column = self.get_or_create_column(pos.x);
                            column.spills.set(pos.y, Some(pos.to_sheet_pos(sheet_id)));
                        }
                        Value::Array(array) => {
                            let start = pos.x;
                            let end = start + array.width() as i64;
                            let range = Range {
                                start: pos.y,
                                end: pos.y + array.height() as i64,
                            };
                            for x in start..end {
                                let column = self.get_or_create_column(x);
                                column
                                    .spills
                                    .set_range(range.clone(), pos.to_sheet_pos(sheet_id));
                            }
                        }
                    },
                    None => {
                        let column = self.get_or_create_column(pos.x);
                        column.spills.set(pos.y, Some(pos.to_sheet_pos(sheet_id)));
                    }
                }
            }
            self.code_cells.insert(pos, code_cell);
        }
        old
    }

    /// Returns a code cell value.
    pub fn get_code_cell(&self, pos: Pos) -> Option<&CodeCellValue> {
        self.code_cells.get(&pos)
    }

    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        let block = column.spills.get(pos.y)?;
        let code_cell = self.code_cells.get(&block.into())?;
        code_cell.get_output_value((pos.x - pos.x) as u32, (pos.y - pos.y) as u32)
    }

    /// Returns an iterator over all locations containing code cells that may
    /// spill into `region`.
    pub fn iter_code_cells_locations_in_region(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = SheetPos> {
        // Scan spilled cells to find code cells. TODO: this won't work for
        // unspilled code cells
        let code_cell_pos: HashSet<SheetPos> = self
            .columns
            .range(rect.x_range())
            .flat_map(|(_x, column)| {
                column
                    .spills
                    .blocks_covering_range(rect.y_range())
                    .map(|block| block.content().value)
            })
            .collect();

        code_cell_pos.into_iter()
    }

    pub fn iter_code_cells_locations(&self) -> impl '_ + Iterator<Item = Pos> {
        self.code_cells.keys().copied()
    }
}
