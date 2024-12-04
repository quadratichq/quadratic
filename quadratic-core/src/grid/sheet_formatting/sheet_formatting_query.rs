//! Querying sheet formatting.

use super::*;

use crate::{grid::formats::Format, Pos};

impl SheetFormatting {
    /// Returns the maximum value in the column for which formatting exists.
    pub fn column_max(&self, column: i64) -> Option<i64> {
        [
            self.align.column_max(column),
            self.vertical_align.column_max(column),
            self.wrap.column_max(column),
            self.numeric_format.column_max(column),
            self.numeric_decimals.column_max(column),
            self.numeric_commas.column_max(column),
            self.bold.column_max(column),
            self.italic.column_max(column),
            self.text_color.column_max(column),
            self.fill_color.column_max(column),
            self.render_size.column_max(column),
            self.date_time.column_max(column),
            self.underline.column_max(column),
            self.strike_through.column_max(column),
        ]
        .iter()
        .copied()
        .max()
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
            align: self.align.get(pos).copied(),
            vertical_align: self.vertical_align.get(pos).copied(),
            wrap: self.wrap.get(pos).copied(),
            numeric_format: self.numeric_format.get(pos).cloned(),
            numeric_decimals: self.numeric_decimals.get(pos).copied(),
            numeric_commas: self.numeric_commas.get(pos).copied(),
            bold: self.bold.get(pos).copied(),
            italic: self.italic.get(pos).copied(),
            text_color: self.text_color.get(pos).cloned(),
            fill_color: self.fill_color.get(pos).cloned(),
            render_size: self.render_size.get(pos).cloned(),
            date_time: self.date_time.get(pos).cloned(),
            underline: self.underline.get(pos).copied(),
            strike_through: self.strike_through.get(pos).copied(),
        }
    }

    pub fn column_has_fills(&self, column: i64) -> bool {
        !self.fill_color.is_column_empty(column)
    }

    pub fn row_has_fills(&self, row: i64) -> bool {
        !self.fill_color.is_row_empty(row)
    }

    pub fn row_has_wrap(&self, row: i64) -> bool {
        !self.wrap.is_row_empty(row)
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
        formatting
            .fill_color
            .set(pos![B2], Some("#FF0000".to_string()));
        formatting.wrap.set(pos![D1], Some(CellWrap::Wrap));
        formatting
    }

    #[test]
    fn test_column_max() {
        let formatting = create_test_formatting();
        assert_eq!(formatting.column_max(0), Some(2)); // Column 0 has entries up to row 2
        assert_eq!(formatting.column_max(1), Some(1));
        assert_eq!(formatting.column_max(2), None); // Column 2 has no entries
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
