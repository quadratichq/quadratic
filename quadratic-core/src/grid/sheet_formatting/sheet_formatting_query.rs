//! Querying sheet formatting.

use super::*;

use crate::{
    grid::{formats::Format, GridBounds},
    Pos, Rect,
};

impl SheetFormatting {
    /// Returns the maximum value in the column for which formatting exists.
    pub fn column_max(&self, column: i64) -> Option<i64> {
        [
            self.align.col_max(column),
            self.vertical_align.col_max(column),
            self.wrap.col_max(column),
            self.numeric_format.col_max(column),
            self.numeric_decimals.col_max(column),
            self.numeric_commas.col_max(column),
            self.bold.col_max(column),
            self.italic.col_max(column),
            self.text_color.col_max(column),
            self.fill_color.col_max(column),
            self.render_size.col_max(column),
            self.date_time.col_max(column),
            self.underline.col_max(column),
            self.strike_through.col_max(column),
        ]
        .iter()
        .copied()
        .max()
    }

    pub fn has_format_in_column(&self, column: i64) -> bool {
        self.align.col_max(column) > 0
            || self.vertical_align.col_max(column) > 0
            || self.wrap.col_max(column) > 0
            || self.numeric_format.col_max(column) > 0
            || self.numeric_decimals.col_max(column) > 0
            || self.numeric_commas.col_max(column) > 0
            || self.bold.col_max(column) > 0
            || self.italic.col_max(column) > 0
            || self.text_color.col_max(column) > 0
            || self.fill_color.col_max(column) > 0
            || self.render_size.col_max(column) > 0
            || self.date_time.col_max(column) > 0
            || self.underline.col_max(column) > 0
            || self.strike_through.col_max(column) > 0
    }

    pub fn has_format_in_row(&self, row: i64) -> bool {
        self.align.row_max(row) > 0
            || self.vertical_align.row_max(row) > 0
            || self.wrap.row_max(row) > 0
            || self.numeric_format.row_max(row) > 0
            || self.numeric_decimals.row_max(row) > 0
            || self.numeric_commas.row_max(row) > 0
            || self.bold.row_max(row) > 0
            || self.italic.row_max(row) > 0
            || self.text_color.row_max(row) > 0
            || self.fill_color.row_max(row) > 0
            || self.render_size.row_max(row) > 0
            || self.date_time.row_max(row) > 0
            || self.underline.row_max(row) > 0
            || self.strike_through.row_max(row) > 0
    }

    /// Returns format for a cell or None if default.
    pub fn try_format(&self, pos: Pos) -> Option<Format> {
        let format = self.format(pos);
        if format.is_default() {
            None
        } else {
            Some(format)
        }
    }

    /// Returns all formatting values for a cell.
    pub fn format(&self, pos: Pos) -> Format {
        Format {
            align: self.align.get(pos),
            vertical_align: self.vertical_align.get(pos),
            wrap: self.wrap.get(pos),
            numeric_format: self.numeric_format.get(pos),
            numeric_decimals: self.numeric_decimals.get(pos),
            numeric_commas: self.numeric_commas.get(pos),
            bold: self.bold.get(pos),
            italic: self.italic.get(pos),
            text_color: self.text_color.get(pos),
            fill_color: self.fill_color.get(pos),
            render_size: self.render_size.get(pos),
            date_time: self.date_time.get(pos),
            underline: self.underline.get(pos),
            strike_through: self.strike_through.get(pos),
        }
    }

    pub fn column_has_fills(&self, column: i64) -> bool {
        !self.fill_color.is_col_default(column)
    }

    pub fn row_has_fills(&self, row: i64) -> bool {
        !self.fill_color.is_row_default(row)
    }

    pub fn row_has_wrap(&self, row: i64) -> bool {
        !self.wrap.is_row_default(row)
    }

    /// Returns the finite bounds of the formatting.
    pub fn finite_bounds(&self) -> Option<Rect> {
        let mut bounds = GridBounds::default();
        self.align.finite_bounds().map(|rect| bounds.add_rect(rect));
        self.vertical_align
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.wrap.finite_bounds().map(|rect| bounds.add_rect(rect));
        self.numeric_format
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.numeric_decimals
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.numeric_commas
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.bold.finite_bounds().map(|rect| bounds.add_rect(rect));
        self.italic
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.text_color
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.fill_color
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.render_size
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.date_time
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.underline
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        self.strike_through
            .finite_bounds()
            .map(|rect| bounds.add_rect(rect));
        bounds.into()
    }

    /// Returns the maximum value in the column for which formatting exists.
    pub fn col_max(&self, column: i64) -> Option<i64> {
        let col_maxes = vec![
            self.align.col_max(column),
            self.vertical_align.col_max(column),
            self.wrap.col_max(column),
            self.numeric_format.col_max(column),
            self.numeric_decimals.col_max(column),
            self.numeric_commas.col_max(column),
            self.bold.col_max(column),
            self.italic.col_max(column),
            self.text_color.col_max(column),
            self.fill_color.col_max(column),
            self.render_size.col_max(column),
            self.date_time.col_max(column),
            self.underline.col_max(column),
            self.strike_through.col_max(column),
        ];
        let max = col_maxes.iter().max()?;
        if *max == 0 {
            None
        } else {
            Some(*max)
        }
    }

    /// Returns the maximum value in the row for which formatting exists.
    pub fn row_max(&self, row: i64) -> Option<i64> {
        let row_maxes = vec![
            self.align.row_max(row),
            self.vertical_align.row_max(row),
            self.wrap.row_max(row),
            self.numeric_format.row_max(row),
            self.numeric_decimals.row_max(row),
            self.numeric_commas.row_max(row),
            self.bold.row_max(row),
            self.italic.row_max(row),
            self.text_color.row_max(row),
            self.fill_color.row_max(row),
            self.render_size.row_max(row),
            self.date_time.row_max(row),
            self.underline.row_max(row),
            self.strike_through.row_max(row),
        ];
        let max = row_maxes.iter().max()?;
        if *max == 0 {
            None
        } else {
            Some(*max)
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    fn create_test_formatting() -> SheetFormatting {
        let mut formatting = SheetFormatting::default();
        // Add some test data
        formatting.align.set(pos![A1], Some(CellAlign::Center));
        formatting.bold.set(pos![B1], Some(true));
        formatting.wrap.set(pos![D1], Some(CellWrap::Wrap));
        formatting
            .fill_color
            .set(pos![A2], Some("rgb(241, 196, 15)".to_string()));
        formatting
    }

    #[test]
    fn test_column_max() {
        let formatting = create_test_formatting();
        assert_eq!(formatting.column_max(1), Some(2)); // Column 0 has entries up to row 2
        assert_eq!(formatting.column_max(2), Some(1));
        assert_eq!(formatting.column_max(3), Some(0)); // Column 2 has no entries
    }

    #[test]
    fn test_format() {
        let formatting = create_test_formatting();

        // Test cell with formatting
        let format = formatting.format(pos![A1]);
        assert_eq!(format.align, Some(CellAlign::Center));

        // Test cell without formatting
        let empty_format = formatting.format(pos![D5]);
        assert!(empty_format.is_default());
    }

    #[test]
    fn test_try_format() {
        let formatting = create_test_formatting();

        // Should return Some(Format) for formatted cell
        assert!(formatting.try_format(pos![A1]).is_some());

        // Should return None for unformatted cell
        assert!(formatting.try_format(pos![D5]).is_none());
    }

    #[test]
    fn test_column_and_row_has_fills() {
        let formatting = create_test_formatting();

        assert!(formatting.column_has_fills(1));
        assert!(!formatting.column_has_fills(2));

        assert!(formatting.row_has_fills(2));
        assert!(!formatting.row_has_fills(3));
    }

    #[test]
    fn test_row_has_wrap() {
        let formatting = create_test_formatting();

        assert!(formatting.row_has_wrap(1));
        assert!(!formatting.row_has_wrap(4));
    }
}
