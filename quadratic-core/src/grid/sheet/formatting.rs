use crate::{
    grid::{CellFmtAttr, CellWrap},
    Pos, Rect, RunLengthEncoding, SheetRect,
};

use super::Sheet;

impl Sheet {
    /// Set the cell formatting for a sheet_rect.
    pub fn set_cell_formats_for_type<A: CellFmtAttr>(
        &mut self,
        sheet_rect: &SheetRect,
        values: RunLengthEncoding<Option<A::Value>>,
    ) -> RunLengthEncoding<Option<A::Value>> {
        // todo: optimize this for contiguous runs of the same value
        let mut old_values = RunLengthEncoding::new();
        let mut i = 0;
        for y in sheet_rect.y_range() {
            for x in sheet_rect.x_range() {
                let pos = Pos { x, y };
                // see note above re: operations returned from set_formatting_value
                let old_value =
                    self.set_formatting_value::<A>(pos, values.get_at(i).unwrap().clone());
                old_values.push(old_value);
                i += 1;
            }
        }
        old_values
    }

    // returns true if any cell in the rect has wrapped text
    pub fn get_wrapped_cells(&self, rect: Rect) -> Option<Vec<Pos>> {
        let mut wrapped_cells = Vec::<Pos>::new();
        for y in rect.y_range() {
            for x in rect.x_range() {
                let cell_wrap = self.get_formatting_value::<CellWrap>(Pos { x, y });
                let cell_value = self.cell_value(Pos { x, y });
                if cell_wrap == Some(CellWrap::Wrap) && cell_value.is_some() {
                    wrapped_cells.push(Pos { x, y });
                }
            }
        }
        if wrapped_cells.is_empty() {
            None
        } else {
            Some(wrapped_cells)
        }
    }
}
