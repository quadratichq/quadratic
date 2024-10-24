use super::Sheet;
use crate::grid::formats::format_update::FormatUpdate;
use crate::grid::formats::Formats;
use crate::grid::CellFmtAttr;
use crate::selection::OldSelection;
use crate::{Pos, Rect, RunLengthEncoding, SheetRect};

impl Sheet {
    /// Set the cell formatting for a sheet_rect.
    ///
    /// This is deprecated but needed by the old execute_formats
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

    /// Returns Formats within a rect for a sheet that will rewrite destination
    /// formatting. This is used in the paste and (soon) auto-fill operations.
    /// If Selection is provided, it ignores values that do not fall within the
    /// Selection.
    pub fn override_cell_formats(&self, rect: Rect, selection: Option<&OldSelection>) -> Formats {
        let mut formats = Formats::default();
        for x in rect.x_range() {
            for y in rect.y_range() {
                let pos = Pos { x, y };
                if selection.is_none() || selection.is_some_and(|s| s.contains_pos(pos)) {
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
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn override_cell_formats() {
        let sheet = Sheet::test();
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let selection = OldSelection::rect(rect, sheet.id);
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
        assert_eq!(format.underline, Some(None));
        assert_eq!(format.strike_through, Some(None));
    }
}
