use crate::CellValue;
use crate::Pos;
use crate::a1::A1Context;
use crate::grid::CellAlign;
use crate::grid::CellVerticalAlign;
use crate::grid::CellWrap;
use crate::grid::NumericFormat;
use crate::grid::js_types::CellFormatSummary;
use crate::grid::js_types::CellType;
use crate::{
    a1::{A1Selection, CellRefRange},
    grid::Sheet,
};

// Macro to handle format checking logic
// Example usage of check_format! macro:
//
// let mut bold: Option<Option<bool>> = Some(Some(true));
// check_format!(bold, sheet.formats.bold, range, true);
//
// This expands to:
// if !bold.as_ref().is_some_and(|format| format.is_none()) {
//     let set = sheet.formats.bold.unique_values_in_range(range);
//     if set.len() > 1 {
//         // Multiple different values found, mark as inconsistent
//         bold = Some(None);
//     } else if let Some(Some(new_format)) = set.into_iter().next() {
//         if let Some(Some(current_format)) = bold.as_ref() {
//             if current_format != &new_format {
//                 // New value differs from current, mark as inconsistent
//                 bold = Some(None);
//             }
//         } else {
//             // No current value, use the new value
//             bold = Some(Some(new_format));
//         }
//     }
// }

macro_rules! check_format {
    ($format_var:ident, $formats_field:expr, $range:expr) => {
        if !$format_var.as_ref().is_some_and(|format| format.is_none()) {
            let set = $formats_field.unique_values_in_range($range);
            if set.len() > 1 {
                // Multiple different values found, mark as inconsistent
                $format_var = Some(None);
            } else if let Some(Some(new_format)) = set.into_iter().next() {
                if let Some(Some(current_format)) = $format_var.as_ref() {
                    if current_format != &new_format {
                        // New value differs from current, mark as inconsistent
                        $format_var = Some(None);
                    }
                } else {
                    // No current value, use the new value
                    $format_var = Some(Some(new_format));
                }
            }
        }
    };
}

impl Sheet {
    /// Returns a summary of formatting for a cell.
    pub fn cell_format_summary(&self, pos: Pos) -> CellFormatSummary {
        let format = self.cell_format(pos);
        let cell_type = self
            .display_value(pos)
            .and_then(|cell_value| match cell_value {
                CellValue::Date(_) => Some(CellType::Date),
                CellValue::DateTime(_) => Some(CellType::DateTime),
                _ => None,
            });
        CellFormatSummary {
            bold: format.bold,
            italic: format.italic,
            text_color: format.text_color,
            fill_color: format.fill_color,
            commas: format.numeric_commas,
            align: format.align,
            vertical_align: format.vertical_align,
            wrap: format.wrap,
            date_time: format.date_time,
            cell_type,
            underline: format.underline,
            strike_through: format.strike_through,
            numeric_format: format.numeric_format,
        }
    }

    /// Gets the common formatting for a selection. Note: this does not pass any
    /// information about date or time.
    pub fn format_selection(
        &self,
        selection: &A1Selection,
        context: &A1Context,
    ) -> CellFormatSummary {
        // track styles set on ranges
        // - None means the style has not been set in the range
        // - Some(None) means the style is not consistent
        // - Some(style) means the style has been set
        let mut align: Option<Option<CellAlign>> = None;
        let mut vertical_align: Option<Option<CellVerticalAlign>> = None;
        let mut wrap: Option<Option<CellWrap>> = None;
        let mut numeric_format: Option<Option<NumericFormat>> = None;
        let mut numeric_decimals: Option<Option<i16>> = None;
        let mut numeric_commas: Option<Option<bool>> = None;
        let mut bold: Option<Option<bool>> = None;
        let mut italic: Option<Option<bool>> = None;
        let mut text_color: Option<Option<String>> = None;
        let mut fill_color: Option<Option<String>> = None;
        let mut underline: Option<Option<bool>> = None;
        let mut strike_through: Option<Option<bool>> = None;

        selection.ranges.iter().for_each(|range| {
            // convert table ranges to sheet ranges to make this easier
            let range = match range {
                CellRefRange::Table { range } => {
                    if let Some(range) =
                        range.convert_to_ref_range_bounds(false, context, false, false)
                    {
                        range
                    } else {
                        return;
                    }
                }
                CellRefRange::Sheet { range } => *range,
            };

            check_format!(align, self.formats.align, range);
            check_format!(vertical_align, self.formats.vertical_align, range);
            check_format!(wrap, self.formats.wrap, range);
            check_format!(numeric_format, self.formats.numeric_format, range);
            check_format!(numeric_decimals, self.formats.numeric_decimals, range);
            check_format!(numeric_commas, self.formats.numeric_commas, range);
            check_format!(bold, self.formats.bold, range);
            check_format!(italic, self.formats.italic, range);
            check_format!(text_color, self.formats.text_color, range);
            check_format!(fill_color, self.formats.fill_color, range);
            check_format!(underline, self.formats.underline, range);
            check_format!(strike_through, self.formats.strike_through, range);

            if let Some(rect) = range.to_rect() {
                self.data_tables_intersect_rect_sorted(rect)
                    .for_each(|(_, pos, data_table)| {
                        // adjust the range by the data table position and
                        // add any formatting from the data table to the
                        // current formatting
                        let range = range.translate_unchecked(
                            -pos.x + 1,
                            -pos.y - data_table.y_adjustment(true) + 1,
                        );
                        if let Some(formats) = data_table.formats.as_ref() {
                            check_format!(align, formats.align, range);
                            check_format!(vertical_align, formats.vertical_align, range);
                            check_format!(wrap, formats.wrap, range);
                            check_format!(numeric_format, formats.numeric_format, range);
                            check_format!(numeric_decimals, formats.numeric_decimals, range);
                            check_format!(numeric_commas, formats.numeric_commas, range);
                            check_format!(bold, formats.bold, range);
                            check_format!(italic, formats.italic, range);
                            check_format!(text_color, formats.text_color, range);
                            check_format!(fill_color, formats.fill_color, range);
                            check_format!(underline, formats.underline, range);
                            check_format!(strike_through, formats.strike_through, range);
                        }
                    });
            }
        });

        CellFormatSummary {
            align: align.and_then(|x| x),
            vertical_align: vertical_align.and_then(|x| x),
            wrap: wrap.and_then(|x| x),
            commas: numeric_commas.and_then(|x| x),
            bold: bold.and_then(|x| x),
            italic: italic.and_then(|x| x),
            text_color: text_color.and_then(|x| x),
            fill_color: fill_color.and_then(|x| x),
            underline: underline.and_then(|x| x),
            strike_through: strike_through.and_then(|x| x),
            date_time: None,
            cell_type: None,
            numeric_format: numeric_format.and_then(|x| x),
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{a1::A1Selection, grid::formats::FormatUpdate, test_util::*};

    #[test]
    fn test_format_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_bold(&A1Selection::test_a1("A1:A5"), Some(true), None, false)
            .unwrap();
        gc.set_italic(&A1Selection::test_a1("B1:B5"), Some(true), None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);

        let summary = sheet.format_selection(&A1Selection::test_a1("A1:A5"), gc.a1_context());
        assert_eq!(summary.bold, Some(true));
        assert_eq!(summary.italic, None);

        let summary = sheet.format_selection(&A1Selection::test_a1("A1:A10"), gc.a1_context());
        assert_eq!(summary.bold, None);
        assert_eq!(summary.italic, None);

        let summary = sheet.format_selection(&A1Selection::test_a1("B1:B5"), gc.a1_context());
        assert_eq!(summary.bold, None);
        assert_eq!(summary.italic, Some(true));

        let summary = sheet.format_selection(&A1Selection::test_a1("A1:B5"), gc.a1_context());
        assert_eq!(summary.bold, None);
        assert_eq!(summary.italic, None);
    }

    #[test]
    fn test_format_selection_with_data_tables() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B1], 2, 2);

        gc.set_bold(&A1Selection::test_a1("B3"), Some(true), None, false)
            .unwrap();

        gc.set_formats(
            &A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context()),
            FormatUpdate {
                italic: Some(Some(true)),
                ..Default::default()
            },
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let summary = sheet.format_selection(&A1Selection::test_a1("B3"), gc.a1_context());
        assert_eq!(summary.bold, Some(true));
        assert_eq!(summary.italic, Some(true));
    }
}
