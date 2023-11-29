use std::{collections::HashSet, ops::Range};

use itertools::Itertools;

use super::Sheet;
use crate::{
    grid::{CellRef, CodeCellValue, RenderSize},
    CellValue, Pos, Rect, Value,
};

impl Sheet {
    /// Sets or deletes a code cell value and populates spills.
    pub fn set_code_cell_value(
        &mut self,
        pos: Pos,
        code_cell: Option<CodeCellValue>,
    ) -> Option<CodeCellValue> {
        let cell_ref = self.get_or_create_cell_ref(pos);
        let old = self.code_cells.remove(&cell_ref);

        if let Some(code_cell) = code_cell {
            if let Some(output) = &code_cell.output {
                match output.output_value() {
                    Some(output_value) => {
                        match output_value {
                            Value::Single(_) => {
                                let (_, column) = self.get_or_create_column(pos.x);
                                column.spills.set(pos.y, Some(cell_ref));
                            }
                            Value::Array(array) => {
                                // if spilled only set the top left cell
                                if output.spill {
                                    let (_, column) = self.get_or_create_column(pos.x);
                                    column.spills.set(pos.y, Some(cell_ref));
                                }
                                // otherwise set the whole array
                                else {
                                    let start = pos.x;
                                    let end = start + array.width() as i64;
                                    let range = Range {
                                        start: pos.y,
                                        end: pos.y + array.height() as i64,
                                    };
                                    for x in start..end {
                                        let (_, column) = self.get_or_create_column(x);
                                        column.spills.set_range(range.clone(), cell_ref);
                                    }
                                }
                            }
                        }
                    }
                    None => {
                        let (_, column) = self.get_or_create_column(pos.x);
                        column.spills.set(pos.y, Some(cell_ref));
                    }
                }
            } else {
                let (_, column) = self.get_or_create_column(pos.x);
                column.spills.set(pos.y, Some(cell_ref));
            }
            self.code_cells.insert(cell_ref, code_cell);
        }
        old
    }

    /// Returns a code cell value.
    pub fn get_code_cell(&self, pos: Pos) -> Option<&CodeCellValue> {
        self.code_cells.get(&self.try_get_cell_ref(pos)?)
    }

    /// Returns a code cell value.
    pub fn get_code_cell_from_ref(&self, cell_ref: CellRef) -> Option<&CodeCellValue> {
        self.code_cells.get(&cell_ref)
    }

    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        let block = column.spills.get(pos.y)?;
        let code_cell_pos = self.cell_ref_to_pos(block)?;
        let code_cell = self.code_cells.get(&block)?;
        code_cell.get_output_value(
            (pos.x - code_cell_pos.x) as u32,
            (pos.y - code_cell_pos.y) as u32,
        )
    }

    /// Get the spill location for a given cell_ref.  Note that a spill is
    /// also stored as as cell_ref.
    pub fn get_spill(&self, cell_ref: CellRef) -> Option<CellRef> {
        let pos = self.cell_ref_to_pos(cell_ref)?;
        let column = self.get_column(pos.x)?;
        column.spills.get(pos.y)
    }

    /// Returns an iterator over all locations containing code cells that may
    /// spill into `region`.
    pub fn iter_code_cells_locations_in_region(
        &self,
        region: Rect,
    ) -> impl Iterator<Item = CellRef> {
        let code_cell_refs: HashSet<CellRef> = self
            .columns
            .range(region.x_range())
            .flat_map(|(_x, column)| {
                column
                    .spills
                    .blocks_covering_range(region.y_range())
                    .map(|block| block.content().value)
            })
            .collect();

        code_cell_refs.into_iter()
    }

    pub fn iter_code_cells_locations(&self) -> impl '_ + Iterator<Item = CellRef> {
        self.code_cells.keys().copied()
    }

    /// returns the render-size for a html-like cell
    pub fn render_size(&self, pos: Pos) -> Option<RenderSize> {
        let column = self.get_column(pos.x)?;
        column.render_size.get(pos.y)
    }

    /// Checks if the deletion of a cell or a code_cell released a spill error;
    /// sorted by earliest last_modified.
    /// Returns the cell_ref and the code_cell_value if it did
    pub fn spill_error_released(&self, cell_ref: CellRef) -> Option<(CellRef, CodeCellValue)> {
        self.code_cells
            .iter()
            .filter(|(_, code_cell)| code_cell.has_spill_error())
            .sorted_by_key(|a| &a.1.last_modified)
            .filter_map(|(code_cell_ref, code_cell)| {
                let pos = self.cell_ref_to_pos(*code_cell_ref)?;
                let array_size = code_cell.output_size();
                let rect = Rect::from_pos_and_size(pos, array_size);

                self.existing_region(rect)
                    .contains(&cell_ref)
                    .then(|| (*code_cell_ref, code_cell.to_owned()))
            })
            .find(|(cell_ref, code_cell)| {
                let array_size = code_cell.output_size();
                if array_size.len() > 1 {
                    !self
                        .is_ok_to_spill_in(*cell_ref, array_size)
                        .unwrap_or(false)
                } else {
                    false
                }
            })
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, grid::RenderSize, Rect};

    #[test]
    fn test_render_size() {
        use crate::Pos;

        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_render_size(
            sheet_id,
            Rect::single_pos(Pos { x: 0, y: 0 }),
            Some(crate::grid::RenderSize { w: 10, h: 20 }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.render_size(Pos { x: 0, y: 0 }),
            Some(RenderSize { w: 10, h: 20 })
        );
        assert_eq!(sheet.render_size(Pos { x: 1, y: 1 }), None);
    }
}
