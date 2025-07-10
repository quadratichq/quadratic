use crate::grid::CellAlign;
use crate::grid::CellVerticalAlign;
use crate::grid::CellWrap;
use crate::grid::NumericFormat;
use crate::grid::js_types::CellFormatSummary;
use crate::{
    a1::{A1Selection, CellRefRange},
    grid::Sheet,
};

// Macro to handle format checking logic
macro_rules! check_format {
    ($format_var:ident, $formats_field:expr, $range:expr) => {
        if !$format_var.as_ref().is_some_and(|format| format.is_none()) {
            let set = $formats_field.unique_values_in_range($range);
            if set.len() > 1 {
                $format_var = Some(None);
            } else if let Some(Some(new_format)) = set.into_iter().next() {
                if let Some(Some(current_format)) = $format_var.as_ref() {
                    if current_format != &new_format {
                        $format_var = Some(None);
                    }
                } else {
                    $format_var = Some(Some(new_format));
                }
            }
        }
    };
}

impl Sheet {
    /// Gets the common formatting for a selection. Note: this does not pass any
    /// information about date or time.
    pub fn format_selection(&self, selection: &A1Selection) -> CellFormatSummary {
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

        selection.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                check_format!(align, self.formats.align, *range);
                check_format!(vertical_align, self.formats.vertical_align, *range);
                check_format!(wrap, self.formats.wrap, *range);
                check_format!(numeric_format, self.formats.numeric_format, *range);
                check_format!(numeric_decimals, self.formats.numeric_decimals, *range);
                check_format!(numeric_commas, self.formats.numeric_commas, *range);
                check_format!(bold, self.formats.bold, *range);
                check_format!(italic, self.formats.italic, *range);
                check_format!(text_color, self.formats.text_color, *range);
                check_format!(fill_color, self.formats.fill_color, *range);
                check_format!(underline, self.formats.underline, *range);
                check_format!(strike_through, self.formats.strike_through, *range);
            }
            // todo...
            CellRefRange::Table { .. } => (),
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
    use crate::{a1::A1Selection, test_util::*};

    #[test]
    fn test_format_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_bold(&A1Selection::test_a1("A1:A5"), Some(true), None)
            .unwrap();
        gc.set_italic(&A1Selection::test_a1("B1:B5"), Some(true), None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);

        let summary = sheet.format_selection(&A1Selection::test_a1("A1:A5"));
        assert_eq!(summary.bold, Some(true));
        assert_eq!(summary.italic, None);

        let summary = sheet.format_selection(&A1Selection::test_a1("A1:A10"));
        assert_eq!(summary.bold, None);
        assert_eq!(summary.italic, None);

        let summary = sheet.format_selection(&A1Selection::test_a1("B1:B5"));
        assert_eq!(summary.bold, None);
        assert_eq!(summary.italic, Some(true));

        let summary = sheet.format_selection(&A1Selection::test_a1("A1:B5"));
        assert_eq!(summary.bold, None);
        assert_eq!(summary.italic, None);
    }
}
