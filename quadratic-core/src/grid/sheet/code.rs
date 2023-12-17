use std::collections::HashSet;

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
