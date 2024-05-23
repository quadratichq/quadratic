use super::Sheet;
use crate::{grid::CellFmtAttr, selection::Selection, Pos, RunLengthEncoding, SheetRect};

impl Sheet {
    /// Set the cell formatting for a sheet_rect.
    pub fn set_cell_formats_for_type<A: CellFmtAttr>(
        &mut self,
        selection: &Selection,
        values: RunLengthEncoding<Option<A::Value>>,
    ) -> RunLengthEncoding<Option<A::Value>> {
        // todo: optimize this for contiguous runs of the same value
        let mut old_values = RunLengthEncoding::new();

        if let Some(rects) = selection.rects.as_ref() {
            rects.iter().for_each(|rect| {
                let mut i = 0;
                for y in rect.y_range() {
                    for x in rect.x_range() {
                        let pos = Pos { x, y };
                        // see note above re: operations returned from set_formatting_value
                        let old_value =
                            self.set_formatting_value::<A>(pos, values.get_at(i).unwrap().clone());
                        old_values.push(old_value);
                        i += 1;
                    }
                }
            });
        }
        old_values
    }
}
