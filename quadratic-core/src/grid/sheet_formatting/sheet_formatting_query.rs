//! Querying sheet formatting.

use super::*;

use crate::{
    Pos, Rect,
    grid::{GridBounds, formats::Format},
};

impl SheetFormatting {
    /// Returns format for a cell or None if default.
    pub(crate) fn try_format(&self, pos: Pos) -> Option<Format> {
        let format = self.format(pos);
        if format.is_default() {
            None
        } else {
            Some(format)
        }
    }

    /// Returns all formatting values for a cell.
    pub(crate) fn format(&self, pos: Pos) -> Format {
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
            date_time: self.date_time.get(pos),
            underline: self.underline.get(pos),
            strike_through: self.strike_through.get(pos),
        }
    }

    /// Returns the finite bounds of the formatting.
    pub(crate) fn finite_bounds(&self) -> Option<Rect> {
        let mut bounds = GridBounds::default();
        if let Some(rect) = self.align.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.vertical_align.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.wrap.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.numeric_format.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.numeric_decimals.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.numeric_commas.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.bold.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.italic.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.text_color.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.fill_color.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.date_time.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.underline.finite_bounds() {
            bounds.add_rect(rect);
        }
        if let Some(rect) = self.strike_through.finite_bounds() {
            bounds.add_rect(rect);
        }
        bounds.into()
    }

    /// Returns the minimum value in the column for which formatting exists.
    pub(crate) fn col_min(&self, column: i64) -> Option<i64> {
        let col_mins = [
            self.align.col_min(column),
            self.vertical_align.col_min(column),
            self.wrap.col_min(column),
            self.numeric_format.col_min(column),
            self.numeric_decimals.col_min(column),
            self.numeric_commas.col_min(column),
            self.bold.col_min(column),
            self.italic.col_min(column),
            self.text_color.col_min(column),
            self.fill_color.col_min(column),
            self.date_time.col_min(column),
            self.underline.col_min(column),
            self.strike_through.col_min(column),
        ];
        let min = col_mins.iter().filter(|&&x| x != 0).min()?;
        if *min == 0 { None } else { Some(*min) }
    }

    /// Returns the maximum value in the column for which formatting exists.
    pub(crate) fn col_max(&self, column: i64) -> Option<i64> {
        let col_maxes = [
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
            self.date_time.col_max(column),
            self.underline.col_max(column),
            self.strike_through.col_max(column),
        ];
        let max = col_maxes.iter().max()?;
        if *max == 0 { None } else { Some(*max) }
    }

    pub(crate) fn row_min(&self, row: i64) -> Option<i64> {
        let row_mins = [
            self.align.row_min(row),
            self.vertical_align.row_min(row),
            self.wrap.row_min(row),
            self.numeric_format.row_min(row),
            self.numeric_decimals.row_min(row),
            self.numeric_commas.row_min(row),
            self.bold.row_min(row),
            self.italic.row_min(row),
            self.text_color.row_min(row),
            self.fill_color.row_min(row),
            self.date_time.row_min(row),
            self.underline.row_min(row),
            self.strike_through.row_min(row),
        ];
        let min = row_mins.iter().filter(|&&x| x != 0).min()?;
        if *min == 0 { None } else { Some(*min) }
    }

    /// Returns the maximum value in the row for which formatting exists.
    pub(crate) fn row_max(&self, row: i64) -> Option<i64> {
        let row_maxes = [
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
            self.date_time.row_max(row),
            self.underline.row_max(row),
            self.strike_through.row_max(row),
        ];
        let max = row_maxes.iter().max()?;
        if *max == 0 { None } else { Some(*max) }
    }

    /// Returns true if there is any formatting with a fill color.
    pub(crate) fn has_fills(&self) -> bool {
        !self.fill_color.is_all_default()
    }
}

#[cfg(test)]
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
    fn test_row_min() {
        let formatting = create_test_formatting();
        assert_eq!(formatting.row_min(1), Some(1));
        assert_eq!(formatting.row_min(2), Some(1));
        assert_eq!(formatting.row_min(3), None);
    }

    #[test]
    fn test_finite_bounds() {
        let formatting = create_test_formatting();

        let bounds = formatting.finite_bounds().unwrap();
        // Should include A1, B1, D1, and A2
        assert_eq!(bounds.min.x, 1); // Column A
        assert_eq!(bounds.max.x, 4); // Column D
        assert_eq!(bounds.min.y, 1); // Row 1
        assert_eq!(bounds.max.y, 2); // Row 2
    }

    #[test]
    fn test_col_min() {
        let formatting = create_test_formatting();

        assert_eq!(formatting.col_min(1), Some(1));
        assert_eq!(formatting.col_min(2), Some(1));
    }

    #[test]
    fn test_col_max() {
        let formatting = create_test_formatting();

        assert_eq!(formatting.col_max(1), Some(2));
        assert_eq!(formatting.col_max(3), None);
    }

    #[test]
    fn test_row_max() {
        let formatting = create_test_formatting();

        // Row 1 has formatting up to column D (4)
        assert_eq!(formatting.row_max(1), Some(4));
        // Row 3 has no formatting
        assert_eq!(formatting.row_max(3), None);
    }

    #[test]
    fn test_has_fills() {
        let formatting = SheetFormatting::default();
        assert!(!formatting.has_fills());

        let mut formatting = create_test_formatting();
        assert!(formatting.has_fills());

        formatting.fill_color.set(pos![A2], None);
        assert!(!formatting.has_fills());
    }
}
