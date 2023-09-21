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

    // pub fn column_screen(&self, column: i64) -> f64 {
    //     if column == 0 {
    //         0.0
    //     } else if column < 0 {
    //     } else {
    //     }
    // }
}
