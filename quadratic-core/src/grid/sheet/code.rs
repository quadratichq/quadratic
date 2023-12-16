use std::collections::HashSet;

use itertools::Itertools;

use super::Sheet;
use crate::{
    grid::{CodeCell, CodeCellRun, RenderSize},
    CellValue, Pos, Rect,
};

impl Sheet {
    /// Sets or deletes a code cell value. Does not change self.code_cell_runs or column.spills.
    pub fn set_code_cell(&mut self, pos: Pos, code_cell: Option<CodeCell>) -> Option<CodeCell> {
        if let Some(code_cell) = &code_cell {
            self.code_cells.insert(pos, code_cell.to_owned())
        } else {
            self.code_cells.remove(&pos)
        }

        // // this column has to exist since it was just created in the previous statement

        // if let Some(code_cell) = code_cell {
        //     if let Some(output) = &code_cell.output {
        //         match output.output_value() {
        //             Some(output_value) => {
        //                 match output_value {
        //                     Value::Single(_) => {
        //                         code_cell_column.spills.set(pos.y, Some(pos));
        //                     }
        //                     Value::Array(array) => {
        //                         // if spilled only set the top left cell
        //                         if output.spill {
        //                             let column = self.get_or_create_column(pos.x);
        //                             column.spills.set(pos.y, Some(pos));
        //                         }
        //                         // otherwise set the whole array
        //                         else {
        //                             let start = pos.x;
        //                             let end = start + array.width() as i64;
        //                             let range = Range {
        //                                 start: pos.y,
        //                                 end: pos.y + array.height() as i64,
        //                             };
        //                             for x in start..end {
        //                                 let column = self.get_or_create_column(x);
        //                                 column.spills.set_range(range.clone(), pos);
        //                             }
        //                         }
        //                     }
        //                 }
        //             }
        //             None => {
        //                 code_cell_column.spills.set(pos.y, Some(pos));
        //             }
        //         }
        //     } else {
        //         code_cell_column.spills.set(pos.y, Some(pos));
        //     }
        //     self.code_cells.insert(pos, code_cell);
        // }
        // old
    }

    /// Sets or deletes a code cell run. Does not change code_cells or column.spills.
    pub fn set_code_cell_run(
        &mut self,
        pos: Pos,
        code_cell_run: Option<CodeCellRun>,
    ) -> Option<CodeCellRun> {
        if let Some(code_cell_run) = &code_cell_run {
            self.code_cell_runs.insert(pos, code_cell_run.to_owned())
        } else {
            self.code_cell_runs.remove(&pos)
        }
    }

    /// Returns a code cell
    pub fn get_code_cell(&self, pos: Pos) -> Option<&CodeCell> {
        self.code_cells.get(&pos)
    }

    pub fn get_code_cell_run(&self, pos: Pos) -> Option<&CodeCellRun> {
        self.code_cell_runs.get(&pos)
    }

    /// Returns the value of the output of a CodeCellRun at a given position
    /// by checking column.spills and any resulting CodeCellRun
    pub fn get_code_cell_run_output_at(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        let code_cell_pos = column.spills.get(pos.y)?;
        let run = self.get_code_cell_run(code_cell_pos)?;
        run.get_at(
            (pos.x - code_cell_pos.x) as u32,
            (pos.y - code_cell_pos.y) as u32,
        )
    }

    /// Get the spill location for a given position.
    pub fn get_spill(&self, pos: Pos) -> Option<Pos> {
        let column = self.get_column(pos.x)?;
        column.spills.get(pos.y)
    }

    /// Sets the spill for a given position
    pub fn set_spill(&mut self, pos: Pos, spill: Option<Pos>) -> Option<Pos> {
        let column = self.get_or_create_column(pos.x);
        column.spills.set(pos.y, spill)
    }

    /// Returns an iterator over all locations containing code cells that may
    /// spill into `region`.
    pub fn iter_code_cells_in_rect(&self, rect: Rect) -> impl Iterator<Item = Pos> {
        let code_cell_positions: HashSet<Pos> = self
            .columns
            .range(rect.x_range())
            .flat_map(|(_x, column)| {
                column
                    .spills
                    .blocks_covering_range(rect.y_range())
                    .map(|block| block.content().value)
            })
            .collect();

        code_cell_positions.into_iter()
    }

    pub fn iter_code_cells_locations(&self) -> impl '_ + Iterator<Item = Pos> {
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
    pub fn spill_error_released(&self, pos: Pos) -> Option<(Pos, CodeCell)> {
        self.code_cells
            .iter()
            .filter(|(_, code_cell)| code_cell.has_spill_error())
            .sorted_by_key(|a| &a.1.last_modified)
            .filter_map(|(code_cell_pos, code_cell)| {
                let array_size = code_cell.output_size();
                let rect = Rect::from_pos_and_size(pos, array_size);
                rect.contains(pos)
                    .then(|| (*code_cell_pos, code_cell.to_owned()))
            })
            .find(|(code_cell_pos, code_cell)| {
                let array_size = code_cell.output_size();
                if array_size.len() > 1 {
                    !self.has_spill_error(*code_cell_pos, array_size, Some(pos))
                } else {
                    false
                }
            })
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, grid::RenderSize, SheetPos};

    #[test]
    fn test_render_size() {
        use crate::Pos;

        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_render_size(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            }
            .into(),
            Some(crate::grid::RenderSize {
                w: "10".to_string(),
                h: "20".to_string(),
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.render_size(Pos { x: 0, y: 0 }),
            Some(RenderSize {
                w: "10".to_string(),
                h: "20".to_string()
            })
        );
        assert_eq!(sheet.render_size(Pos { x: 1, y: 1 }), None);
    }
}
