use crate::{
    grid::{
        formatting::CellFmtArray, Bold, CellAlign, CellFmtAttr, CellWrap, FillColor, Italic,
        NumericCommas, NumericDecimals, NumericFormat, RenderSize, TextColor,
    },
    Pos, RunLengthEncoding, SheetRect,
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

    /// Gets all cell formats for a sheet using the all old CellFmtArray. This
    /// will eventually be deprecated.
    pub fn get_all_cell_formats(&self, sheet_rect: SheetRect) -> Vec<CellFmtArray> {
        let mut cell_formats = vec![
            CellFmtArray::Align(RunLengthEncoding::new()),
            CellFmtArray::Wrap(RunLengthEncoding::new()),
            CellFmtArray::NumericFormat(RunLengthEncoding::new()),
            CellFmtArray::NumericDecimals(RunLengthEncoding::new()),
            CellFmtArray::NumericCommas(RunLengthEncoding::new()),
            CellFmtArray::Bold(RunLengthEncoding::new()),
            CellFmtArray::Italic(RunLengthEncoding::new()),
            CellFmtArray::TextColor(RunLengthEncoding::new()),
            CellFmtArray::FillColor(RunLengthEncoding::new()),
        ];
        for y in sheet_rect.y_range() {
            for x in sheet_rect.x_range() {
                let pos = Pos { x, y };
                cell_formats.iter_mut().for_each(|array| match array {
                    CellFmtArray::Align(array) => {
                        array.push(self.get_formatting_value::<CellAlign>(pos));
                    }
                    CellFmtArray::Wrap(array) => {
                        array.push(self.get_formatting_value::<CellWrap>(pos));
                    }
                    CellFmtArray::NumericFormat(array) => {
                        array.push(self.get_formatting_value::<NumericFormat>(pos));
                    }
                    CellFmtArray::NumericDecimals(array) => {
                        array.push(self.get_formatting_value::<NumericDecimals>(pos));
                    }
                    CellFmtArray::NumericCommas(array) => {
                        array.push(self.get_formatting_value::<NumericCommas>(pos));
                    }
                    CellFmtArray::Bold(array) => {
                        array.push(self.get_formatting_value::<Bold>(pos));
                    }
                    CellFmtArray::Italic(array) => {
                        array.push(self.get_formatting_value::<Italic>(pos));
                    }
                    CellFmtArray::TextColor(array) => {
                        array.push(self.get_formatting_value::<TextColor>(pos));
                    }
                    CellFmtArray::FillColor(array) => {
                        array.push(self.get_formatting_value::<FillColor>(pos));
                    }
                    CellFmtArray::RenderSize(array) => {
                        array.push(self.get_formatting_value::<RenderSize>(pos));
                    }
                });
            }
        }
        cell_formats
    }
}
