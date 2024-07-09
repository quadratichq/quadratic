use crate::{
    grid::{
        formats::{format_update::FormatUpdate, Formats},
        formatting::CellFmtArray,
        Bold, CellAlign, CellFmtAttr, CellVerticalAlign, CellWrap, FillColor, Italic,
        NumericCommas, NumericDecimals, NumericFormat, RenderSize, TextColor,
    },
    selection::Selection,
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

    /// Gets all cell formats for a sheet using the all old CellFmtArray. This
    /// will eventually be deprecated.
    pub fn get_all_cell_formats(
        &self,
        sheet_rect: SheetRect,
        selection: Option<&Selection>,
    ) -> Vec<CellFmtArray> {
        let mut cell_formats = vec![
            CellFmtArray::Align(RunLengthEncoding::new()),
            CellFmtArray::VerticalAlign(RunLengthEncoding::new()),
            CellFmtArray::Wrap(RunLengthEncoding::new()),
            CellFmtArray::NumericFormat(RunLengthEncoding::new()),
            CellFmtArray::NumericDecimals(RunLengthEncoding::new()),
            CellFmtArray::NumericCommas(RunLengthEncoding::new()),
            CellFmtArray::Bold(RunLengthEncoding::new()),
            CellFmtArray::Italic(RunLengthEncoding::new()),
            CellFmtArray::TextColor(RunLengthEncoding::new()),
            CellFmtArray::FillColor(RunLengthEncoding::new()),
            CellFmtArray::RenderSize(RunLengthEncoding::new()),
        ];
        for y in sheet_rect.y_range() {
            for x in sheet_rect.x_range() {
                let pos = Pos { x, y };
                if selection.is_none() || selection.is_some_and(|s| s.pos_in_selection(pos)) {
                    cell_formats.iter_mut().for_each(|array| match array {
                        CellFmtArray::Align(array) => {
                            array.push(self.get_formatting_value::<CellAlign>(pos));
                        }
                        CellFmtArray::VerticalAlign(array) => {
                            array.push(self.get_formatting_value::<CellVerticalAlign>(pos));
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
                } else {
                    cell_formats.iter_mut().for_each(|array| match array {
                        CellFmtArray::Align(array) => {
                            array.push(None);
                        }
                        CellFmtArray::VerticalAlign(array) => {
                            array.push(None);
                        }
                        CellFmtArray::Wrap(array) => {
                            array.push(None);
                        }
                        CellFmtArray::NumericFormat(array) => {
                            array.push(None);
                        }
                        CellFmtArray::NumericDecimals(array) => {
                            array.push(None);
                        }
                        CellFmtArray::NumericCommas(array) => {
                            array.push(None);
                        }
                        CellFmtArray::Bold(array) => {
                            array.push(None);
                        }
                        CellFmtArray::Italic(array) => {
                            array.push(None);
                        }
                        CellFmtArray::TextColor(array) => {
                            array.push(None);
                        }
                        CellFmtArray::FillColor(array) => {
                            array.push(None);
                        }
                        CellFmtArray::RenderSize(array) => {
                            array.push(None);
                        }
                    });
                }
            }
        }
        cell_formats
    }

    /// Returns Formats within a rect for a sheet that will rewrite destination
    /// formatting. This is used in the paste and (soon) auto-fill operations.
    /// If Selection is provided, it ignores values that do not fall within the
    /// Selection.
    pub fn override_cell_formats(&self, rect: Rect, selection: Option<&Selection>) -> Formats {
        let mut formats = Formats::default();
        for x in rect.x_range() {
            for y in rect.y_range() {
                let pos = Pos { x, y };
                if selection.is_none() || selection.is_some_and(|s| s.pos_in_selection(pos)) {
                    let format = self.format_cell(x, y, true);
                    formats.push(format.to_replace());
                } else {
                    formats.push(FormatUpdate::cleared());
                }
            }
        }
        formats
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn override_cell_formats() {
        let sheet = Sheet::test();
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let selection = Selection::rect(rect, sheet.id);
        let formats = sheet.override_cell_formats(rect, Some(&selection));
        assert_eq!(formats.size(), 4);
        let format = formats.get_at(0).unwrap();
        assert_eq!(format.align, Some(None));
        assert_eq!(format.vertical_align, Some(None));
        assert_eq!(format.wrap, Some(None));
        assert_eq!(format.numeric_format, Some(None));
        assert_eq!(format.numeric_decimals, Some(None));
        assert_eq!(format.numeric_commas, Some(None));
        assert_eq!(format.bold, Some(None));
        assert_eq!(format.italic, Some(None));
        assert_eq!(format.text_color, Some(None));
        assert_eq!(format.fill_color, Some(None));
        assert_eq!(format.render_size, Some(None));
    }
}
