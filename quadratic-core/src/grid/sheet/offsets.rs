use crate::ScreenRect;

use super::Sheet;
use std::ops::Range;

impl Sheet {
    /// Returns the widths of a range of columns.
    pub fn column_widths(&self, x_range: Range<i64>) -> impl '_ + Iterator<Item = f64> {
        self.column_widths.iter_offsets(x_range)
    }
    /// Returns the heights of a range of rows.
    pub fn row_heights(&self, y_range: Range<i64>) -> impl '_ + Iterator<Item = f64> {
        self.row_heights.iter_offsets(y_range)
    }

    /// Sets the width of a column and returns the old width.
    pub fn set_column_width(&mut self, x: i64, width: f64) -> f64 {
        self.column_widths.set_size(x, width)
    }
    /// Sets the height of a row and returns the old height.
    pub fn set_row_height(&mut self, y: i64, height: f64) -> f64 {
        self.row_heights.set_size(y, height)
    }

    /// Resets the width of a column and returns the old width.
    pub fn reset_column_width(&mut self, x: i64) -> f64 {
        self.column_widths.reset(x)
    }
    /// Resets the height of a row and returns the old height.
    pub fn reset_row_height(&mut self, y: i64) -> f64 {
        self.row_heights.reset(y)
    }

    pub fn column_width(&self, x: i64) -> f64 {
        self.column_widths.get_size(x)
    }

    pub fn row_height(&self, y: i64) -> f64 {
        self.row_heights.get_size(y)
    }

    /// gets the column index from an x-coordinate on the screen
    pub fn column_from_x(&self, x: f64) -> (i64, f64) {
        self.column_widths.find_offset(x)
    }
    /// gets the column index from an x-coordinate on the screen
    pub fn row_from_y(&self, y: f64) -> (i64, f64) {
        self.row_heights.find_offset(y)
    }

    /// get the offset rect from a cell
    pub fn cell_offsets(&self, column: i64, row: i64) -> ScreenRect {
        let xs: Vec<f64> = self
            .column_widths
            .iter_offsets(Range {
                start: column,
                end: column + 2,
            })
            .collect();
        let ys: Vec<f64> = self
            .row_heights
            .iter_offsets(Range {
                start: row,
                end: row + 2,
            })
            .collect();
        assert!(xs.len() == 2 && ys.len() == 2);
        let x = *xs.first().unwrap();
        let y = *ys.first().unwrap();
        let w = *xs.last().unwrap() - x;
        let h = *ys.last().unwrap() - y;
        ScreenRect { x, y, w, h }
    }
}
