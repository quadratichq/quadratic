use crate::{
    CopyFormats, DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, MAX_COLUMN_WIDTH, MAX_ROW_HEIGHT,
    MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT, Pos, Rect, ScreenRect, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH,
};
use serde::{Deserialize, Serialize};
use std::ops::Range;
use wasm_bindgen::prelude::wasm_bindgen;

use self::{offsets::Offsets, resize_transient::TransientResize};

pub mod offsets;
pub mod resize_transient;
pub mod sheet_offsets_wasm;
mod wasm;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetOffsets {
    column_widths: Offsets,
    row_heights: Offsets,

    thumbnail: (i64, i64),

    #[serde(skip_serializing, skip_deserializing)]
    transient_resize: Option<TransientResize>,
}

impl Default for SheetOffsets {
    fn default() -> Self {
        let mut offsets = SheetOffsets {
            column_widths: Offsets::new(DEFAULT_COLUMN_WIDTH),
            row_heights: Offsets::new(DEFAULT_ROW_HEIGHT),
            thumbnail: (0, 0),
            transient_resize: None,
        };
        offsets.calculate_thumbnail();
        offsets
    }
}

pub type OffsetWidthHeight = (Vec<(i64, f64)>, Vec<(i64, f64)>);

impl SheetOffsets {
    /// exports offsets to a GridFile
    pub fn export(self) -> OffsetWidthHeight {
        (
            self.column_widths.into_iter_sizes().collect(),
            self.row_heights.into_iter_sizes().collect(),
        )
    }

    /// import offsets from a GridFile
    pub fn import(offsets: OffsetWidthHeight) -> Self {
        let mut offsets = SheetOffsets {
            column_widths: Offsets::from_iter(DEFAULT_COLUMN_WIDTH, offsets.0),
            row_heights: Offsets::from_iter(DEFAULT_ROW_HEIGHT, offsets.1),
            thumbnail: (0, 0),
            transient_resize: None,
        };
        offsets.calculate_thumbnail();
        offsets
    }

    /// Import offsets with optional custom default column width and row height.
    /// This supports the v1.13+ file format which persists custom defaults.
    pub fn import_with_defaults(
        offsets: OffsetWidthHeight,
        default_column_width: Option<f64>,
        default_row_height: Option<f64>,
    ) -> Self {
        let column_default = default_column_width.unwrap_or(DEFAULT_COLUMN_WIDTH);
        let row_default = default_row_height.unwrap_or(DEFAULT_ROW_HEIGHT);
        let mut offsets = SheetOffsets {
            column_widths: Offsets::from_iter(column_default, offsets.0),
            row_heights: Offsets::from_iter(row_default, offsets.1),
            thumbnail: (0, 0),
            transient_resize: None,
        };
        offsets.calculate_thumbnail();
        offsets
    }

    /// Returns the default column width if it differs from the hardcoded default.
    pub fn custom_default_column_width(&self) -> Option<f64> {
        let default = self.defaults().0;
        if (default - DEFAULT_COLUMN_WIDTH).abs() < f64::EPSILON {
            None
        } else {
            Some(default)
        }
    }

    /// Returns the default row height if it differs from the hardcoded default.
    pub fn custom_default_row_height(&self) -> Option<f64> {
        let default = self.defaults().1;
        if (default - DEFAULT_ROW_HEIGHT).abs() < f64::EPSILON {
            None
        } else {
            Some(default)
        }
    }

    /// Returns the widths of a range of columns.
    pub fn column_widths(&self, x_range: Range<i64>) -> impl '_ + Iterator<Item = f64> {
        self.column_widths.iter_offsets(x_range)
    }
    /// Returns the heights of a range of rows.
    pub fn row_heights(&self, y_range: Range<i64>) -> impl '_ + Iterator<Item = f64> {
        self.row_heights.iter_offsets(y_range)
    }

    /// Sets the width of a column and returns the old width.
    /// The width is clamped to MIN_COLUMN_WIDTH..=MAX_COLUMN_WIDTH.
    pub fn set_column_width(&mut self, x: i64, width: f64) -> f64 {
        let clamped_width = width.clamp(MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
        let old = self.column_widths.set_size(x, clamped_width);
        self.calculate_thumbnail();
        old
    }
    /// Sets the height of a row and returns the old height.
    /// The height is clamped to MIN_ROW_HEIGHT..=MAX_ROW_HEIGHT.
    pub fn set_row_height(&mut self, y: i64, height: f64) -> f64 {
        let clamped_height = height.clamp(MIN_ROW_HEIGHT, MAX_ROW_HEIGHT);
        let old = self.row_heights.set_size(y, clamped_height);
        self.calculate_thumbnail();
        old
    }

    /// Resets the width of a column and returns the old width.
    pub fn reset_column_width(&mut self, x: i64) -> f64 {
        let old = self.column_widths.reset(x);
        self.calculate_thumbnail();
        old
    }

    /// Resets the height of a row and returns the old height.
    pub fn reset_row_height(&mut self, y: i64) -> f64 {
        let old = self.row_heights.reset(y);
        self.calculate_thumbnail();
        old
    }

    pub fn column_width(&self, x: i64) -> f64 {
        self.column_widths.get_size(x)
    }

    /// Gets the sum of the widths of a range of columns.
    pub fn total_columns_width(&self, from: i64, to: i64) -> f64 {
        (from..=to).map(|i| self.column_width(i)).sum()
    }

    /// Gets the sum of the heights of a range of rows.
    pub fn total_rows_height(&self, from: i64, to: i64) -> f64 {
        (from..=to).map(|i| self.row_height(i)).sum()
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

    /// gets a column's position and size
    pub fn column_position_size(&self, mut column: i64) -> (f64, f64) {
        if column <= 0 {
            column = 1;
        }
        let xs: Vec<f64> = self
            .column_widths
            .iter_offsets(Range {
                start: column,
                end: column + 2,
            })
            .collect();
        let x1 = *xs.first().unwrap_or(&0f64);
        let x2 = *xs.last().unwrap_or(&0f64);
        (x1, x2 - x1)
    }

    /// gets a row's position and size
    pub fn row_position_size(&self, mut row: i64) -> (f64, f64) {
        if row <= 0 {
            row = 1;
        }
        let ys: Vec<f64> = self
            .row_heights
            .iter_offsets(Range {
                start: row,
                end: row + 2,
            })
            .collect();
        let y1 = *ys.first().unwrap_or(&0f64);
        let y2 = *ys.last().unwrap_or(&0f64);
        (y1, y2 - y1)
    }

    /// get the offset rect from a cell
    pub fn cell_offsets(&self, column: i64, row: i64) -> ScreenRect {
        let (x, w) = self.column_position_size(column);
        let (y, h) = self.row_position_size(row);
        ScreenRect { x, y, w, h }
    }

    /// Gets the start and end screen position for a range of columns (where the
    /// end is the final position + size).
    pub fn column_range(&self, mut x0: i64, mut x1: i64) -> (f64, f64) {
        if x0 <= 0 {
            x0 = 1;
        }
        if x1 <= 0 {
            x1 = 1;
        }
        let xs: Vec<f64> = self
            .column_widths
            .iter_offsets(Range {
                start: x0,
                end: x1 + 2,
            })
            .collect();
        let x1 = *xs.first().unwrap_or(&0f64);
        let x2 = *xs.last().unwrap_or(&0f64);
        (x1, x2)
    }

    // Gets the start and end screen position for a range of rows (where the end
    // is the final position + size).
    pub fn row_range(&self, mut y0: i64, mut y1: i64) -> (f64, f64) {
        if y0 <= 0 {
            y0 = 1;
        }
        if y1 <= 0 {
            y1 = 1;
        }
        let ys: Vec<f64> = self
            .row_heights
            .iter_offsets(Range {
                start: y0,
                end: y1 + 2,
            })
            .collect();
        let y1 = *ys.first().unwrap_or(&0f64);
        let y2 = *ys.last().unwrap_or(&0f64);
        (y1, y2)
    }

    pub fn rect_cell_offsets(&self, rect: Rect) -> Rect {
        let (x_start, x_end) = self.column_range(rect.min.x, rect.max.x);
        let (y_start, y_end) = self.row_range(rect.min.y, rect.max.y);
        Rect {
            min: Pos {
                x: x_start as i64,
                y: y_start as i64,
            },
            max: Pos {
                x: x_end as i64,
                y: y_end as i64,
            },
        }
    }

    // Returns the screen position for a rectangular range of cells.
    pub fn screen_rect_cell_offsets(&self, rect: Rect) -> ScreenRect {
        let (x_start, x_end) = self.column_range(rect.min.x, rect.max.x);
        let (y_start, y_end) = self.row_range(rect.min.y, rect.max.y);
        ScreenRect {
            x: x_start,
            y: y_start,
            w: x_end - x_start,
            h: y_end - y_start,
        }
    }

    /// calculates thumbnail columns and rows that are visible starting from 0,0
    pub fn calculate_thumbnail(&mut self) {
        let mut x = 0;
        let mut y = 0;
        let mut width = 0.0;
        let mut height = 0.0;
        while width < THUMBNAIL_WIDTH {
            width += self.column_width(x);
            x += 1;
        }
        while height < THUMBNAIL_HEIGHT {
            height += self.row_height(y);
            y += 1;
        }
        self.thumbnail = (x, y);
    }

    pub fn thumbnail(&self) -> Rect {
        Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos {
                x: self.thumbnail.0,
                y: self.thumbnail.1,
            },
        }
    }

    /// Inserts a column offset at the given column index.
    ///
    /// Returns a vector of changes made to the offsets structure, where each change
    /// is represented as a tuple (index, new_size).
    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) -> Vec<(i64, f64)> {
        let source_width = self.column_width(if copy_formats == CopyFormats::Before {
            column - 1
        } else {
            column
        });
        self.column_widths.insert(column, Some(source_width))
    }

    /// Deletes a column offset at the given column index.
    ///
    /// Returns a tuple of (Vec<(i64, f64)>, Option<f64>), where the Vec contains
    /// the changes made to the offsets structure, and the Option<f64> is the
    /// old size of the removed offset, if it existed.
    pub fn delete_column(&mut self, column: i64) -> (Vec<(i64, f64)>, Option<f64>) {
        self.column_widths.delete(column)
    }

    /// Inserts a row offset at the given row index.
    ///
    /// Returns a vector of changes made to the offsets structure, where each change
    /// is represented as a tuple (index, new_size).
    pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) -> Vec<(i64, f64)> {
        let source_height = self.row_height(if copy_formats == CopyFormats::Before {
            row - 1
        } else {
            row
        });
        self.row_heights.insert(row, Some(source_height))
    }

    /// Deletes a row offset at the given row index.
    ///
    /// Returns a tuple of (Vec<(i64, f64)>, Option<f64>), where the Vec contains
    /// the changes made to the offsets structure, and the Option<f64> is the
    /// old size of the removed offset, if it existed.
    pub fn delete_row(&mut self, row: i64) -> (Vec<(i64, f64)>, Option<f64>) {
        self.row_heights.delete(row)
    }

    /// Calculates the grid width and height for a given grid position and pixel size.
    pub fn calculate_grid_size(&self, pos: Pos, width: f32, height: f32) -> (u32, u32) {
        let start = self.cell_offsets(pos.x, pos.y);
        let (end_x, _) = self.column_from_x(start.x + width as f64);
        let (end_y, _) = self.row_from_y(start.y + height as f64);
        ((end_x - pos.x + 1) as u32, (end_y - pos.y + 1) as u32)
    }

    /// Returns the default column width and row height.
    pub fn defaults(&self) -> (f64, f64) {
        (self.column_width(0), self.row_height(0))
    }

    /// Returns the minimum and maximum allowed column width.
    pub fn column_width_bounds() -> (f64, f64) {
        (MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH)
    }

    /// Returns the minimum and maximum allowed row height.
    pub fn row_height_bounds() -> (f64, f64) {
        (MIN_ROW_HEIGHT, MAX_ROW_HEIGHT)
    }

    /// Sets the default column widths. Does not change any set sizes.
    /// The size is clamped to MIN_COLUMN_WIDTH..=MAX_COLUMN_WIDTH.
    pub fn set_default_width(&mut self, size: f64) -> f64 {
        let clamped_size = size.clamp(MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
        self.column_widths.set_default(clamped_size)
    }

    /// Sets the default row heights. Does not change any set sizes.
    /// The size is clamped to MIN_ROW_HEIGHT..=MAX_ROW_HEIGHT.
    pub fn set_default_height(&mut self, size: f64) -> f64 {
        let clamped_size = size.clamp(MIN_ROW_HEIGHT, MAX_ROW_HEIGHT);
        self.row_heights.set_default(clamped_size)
    }

    /// Clears all column widths and resets to the default.
    pub fn clear_widths(&mut self) -> Vec<(i64, f64)> {
        self.column_widths.clear()
    }

    /// Clears all row heights and resets to the default.
    pub fn clear_heights(&mut self) -> Vec<(i64, f64)> {
        self.row_heights.clear()
    }

    /// Returns an iterator over custom column widths (non-default widths).
    pub fn iter_column_widths(&self) -> impl '_ + Iterator<Item = (i64, f64)> {
        self.column_widths.iter_sizes()
    }

    /// Returns an iterator over custom row heights (non-default heights).
    pub fn iter_row_heights(&self) -> impl '_ + Iterator<Item = (i64, f64)> {
        self.row_heights.iter_sizes()
    }

    /// Retains only the custom column widths (non-default widths).
    pub fn migration_retain_positive_non_default_offsets(&mut self) {
        self.column_widths
            .migration_retain_positive_non_default_offsets();
        self.row_heights
            .migration_retain_positive_non_default_offsets();
    }
}

#[cfg(test)]
mod test {
    use super::*;

    use crate::{MAX_COLUMN_WIDTH, MAX_ROW_HEIGHT, MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT, Pos, Rect};

    #[test]
    fn test_screen_rect_cell_offsets() {
        let offsets = SheetOffsets::default();
        let rect = Rect::new(1, 1, 1, 1);
        let screen_rect = offsets.screen_rect_cell_offsets(rect);
        assert_eq!(screen_rect.x, 0.0);
        assert_eq!(screen_rect.y, 0.0);
        assert_eq!(screen_rect.w, offsets.defaults().0);
        assert_eq!(screen_rect.h, offsets.defaults().1);

        let rect = Rect::new(1, 1, 2, 2);
        let screen_rect = offsets.screen_rect_cell_offsets(rect);
        assert_eq!(screen_rect.x, 0.0);
        assert_eq!(screen_rect.y, 0.0);
        assert_eq!(screen_rect.w, offsets.defaults().0 * 2.0);
        assert_eq!(screen_rect.h, offsets.defaults().1 * 2.0);
    }

    #[test]
    fn rect_cell_offsets() {
        let offsets = SheetOffsets::default();
        let rect = Rect::new(1, 1, 1, 1);
        let rect = offsets.rect_cell_offsets(rect);
        assert_eq!(rect.min.x, 0);
        assert_eq!(rect.min.y, 0);
        assert_eq!(rect.max.x, offsets.defaults().0 as i64);
        assert_eq!(rect.max.y, offsets.defaults().1 as i64);

        let rect = Rect::from_numbers(1, 1, 2, 2);
        let rect = offsets.rect_cell_offsets(rect);
        assert_eq!(rect.min.x, 0);
        assert_eq!(rect.min.y, 0);
        assert_eq!(rect.max.x, (offsets.defaults().0 * 2.0) as i64);
        assert_eq!(rect.max.y, (offsets.defaults().1 * 2.0) as i64);
    }

    #[test]
    fn test_defaults() {
        let sheet = super::SheetOffsets::default();
        assert_eq!(sheet.defaults(), (100.0, 21.0));
    }

    #[test]
    fn calculate_grid_size() {
        let sheet = super::SheetOffsets::default();
        let (width, height) = sheet.calculate_grid_size(Pos { x: 1, y: 1 }, 100.0, 21.0);
        assert_eq!(width, 2);
        assert_eq!(height, 2);
    }

    #[test]
    fn test_total_widths_heights() {
        let sheet = SheetOffsets::default();
        let (default_col, default_row) = sheet.defaults();

        // Test total width for a range of columns
        assert_eq!(sheet.total_columns_width(1, 3), default_col * 3.0);
        assert_eq!(sheet.total_columns_width(1, 1), default_col);

        // Test total height for a range of rows
        assert_eq!(sheet.total_rows_height(1, 3), default_row * 3.0);
        assert_eq!(sheet.total_rows_height(1, 1), default_row);

        // Test with modified sizes
        let mut sheet = SheetOffsets::default();
        sheet.set_column_width(2, 150.0);
        sheet.set_row_height(2, 30.0);

        assert_eq!(sheet.total_columns_width(1, 3), default_col * 2.0 + 150.0);
        assert_eq!(sheet.total_rows_height(1, 3), default_row * 2.0 + 30.0);
    }

    #[test]
    fn test_set_default_width() {
        let mut sheet = SheetOffsets::default();
        let original_default = sheet.defaults().0;

        // Test setting a new default width
        let new_width = 150.0;
        let old_width = sheet.set_default_width(new_width);
        assert_eq!(old_width, original_default);
        assert_eq!(sheet.defaults().0, new_width);

        // Test that new columns use the new default width
        assert_eq!(sheet.column_width(100), new_width);

        // Test that existing custom widths are preserved
        sheet.set_column_width(1, 200.0);
        sheet.set_default_width(180.0);
        assert_eq!(sheet.column_width(1), 200.0);
        assert_eq!(sheet.column_width(2), 180.0);
    }

    #[test]
    fn test_set_default_height() {
        let mut sheet = SheetOffsets::default();
        let original_default = sheet.defaults().1;

        // Test setting a new default height
        let new_height = 30.0;
        let old_height = sheet.set_default_height(new_height);
        assert_eq!(old_height, original_default);
        assert_eq!(sheet.defaults().1, new_height);

        // Test that new rows use the new default height
        assert_eq!(sheet.row_height(100), new_height);

        // Test that existing custom heights are preserved
        sheet.set_row_height(1, 40.0);
        sheet.set_default_height(35.0);
        assert_eq!(sheet.row_height(1), 40.0);
        assert_eq!(sheet.row_height(2), 35.0);
    }

    #[test]
    fn test_clear_widths() {
        let mut offsets = SheetOffsets::default();
        let default_width = offsets.defaults().0;

        // Set some custom widths
        offsets.set_column_width(1, 150.0);
        offsets.set_column_width(2, 200.0);
        offsets.set_column_width(3, 250.0);

        // Verify custom widths were set
        assert_eq!(offsets.column_width(1), 150.0);
        assert_eq!(offsets.column_width(2), 200.0);
        assert_eq!(offsets.column_width(3), 250.0);

        // Clear all widths
        let cleared = offsets.clear_widths();

        // Verify all widths are reset to default
        assert_eq!(offsets.column_width(1), default_width);
        assert_eq!(offsets.column_width(2), default_width);
        assert_eq!(offsets.column_width(3), default_width);

        // Verify returned vector contains the cleared values
        assert_eq!(cleared.len(), 3);
        assert!(cleared.contains(&(1, 150.0)));
        assert!(cleared.contains(&(2, 200.0)));
        assert!(cleared.contains(&(3, 250.0)));
    }

    #[test]
    fn test_clear_heights() {
        let mut sheet = SheetOffsets::default();
        let default_height = sheet.defaults().1;

        // Set some custom heights
        sheet.set_row_height(1, 30.0);
        sheet.set_row_height(2, 40.0);
        sheet.set_row_height(3, 50.0);

        // Verify custom heights were set
        assert_eq!(sheet.row_height(1), 30.0);
        assert_eq!(sheet.row_height(2), 40.0);
        assert_eq!(sheet.row_height(3), 50.0);

        // Clear all heights
        let cleared = sheet.clear_heights();

        // Verify all heights are reset to default
        assert_eq!(sheet.row_height(1), default_height);
        assert_eq!(sheet.row_height(2), default_height);
        assert_eq!(sheet.row_height(3), default_height);

        // Verify returned vector contains the cleared values
        assert_eq!(cleared.len(), 3);
        assert!(cleared.contains(&(1, 30.0)));
        assert!(cleared.contains(&(2, 40.0)));
        assert!(cleared.contains(&(3, 50.0)));
    }

    #[test]
    fn test_column_width_bounds() {
        let (min, max) = SheetOffsets::column_width_bounds();
        assert_eq!(min, MIN_COLUMN_WIDTH);
        assert_eq!(max, MAX_COLUMN_WIDTH);
    }

    #[test]
    fn test_row_height_bounds() {
        let (min, max) = SheetOffsets::row_height_bounds();
        assert_eq!(min, MIN_ROW_HEIGHT);
        assert_eq!(max, MAX_ROW_HEIGHT);
    }

    #[test]
    fn test_column_width_clamping() {
        let mut sheet = SheetOffsets::default();

        // Test clamping to minimum
        sheet.set_column_width(1, 5.0);
        assert_eq!(sheet.column_width(1), MIN_COLUMN_WIDTH);

        // Test clamping to maximum
        sheet.set_column_width(2, 5000.0);
        assert_eq!(sheet.column_width(2), MAX_COLUMN_WIDTH);

        // Test normal value within bounds
        sheet.set_column_width(3, 150.0);
        assert_eq!(sheet.column_width(3), 150.0);
    }

    #[test]
    fn test_row_height_clamping() {
        let mut sheet = SheetOffsets::default();

        // Test clamping to minimum
        sheet.set_row_height(1, 2.0);
        assert_eq!(sheet.row_height(1), MIN_ROW_HEIGHT);

        // Test clamping to maximum
        sheet.set_row_height(2, 5000.0);
        assert_eq!(sheet.row_height(2), MAX_ROW_HEIGHT);

        // Test normal value within bounds
        sheet.set_row_height(3, 50.0);
        assert_eq!(sheet.row_height(3), 50.0);
    }

    #[test]
    fn test_default_width_clamping() {
        let mut sheet = SheetOffsets::default();

        // Test clamping to minimum
        sheet.set_default_width(5.0);
        assert_eq!(sheet.defaults().0, MIN_COLUMN_WIDTH);

        // Test clamping to maximum
        sheet.set_default_width(5000.0);
        assert_eq!(sheet.defaults().0, MAX_COLUMN_WIDTH);

        // Test normal value within bounds
        sheet.set_default_width(150.0);
        assert_eq!(sheet.defaults().0, 150.0);
    }

    #[test]
    fn test_default_height_clamping() {
        let mut sheet = SheetOffsets::default();

        // Test clamping to minimum
        sheet.set_default_height(2.0);
        assert_eq!(sheet.defaults().1, MIN_ROW_HEIGHT);

        // Test clamping to maximum
        sheet.set_default_height(5000.0);
        assert_eq!(sheet.defaults().1, MAX_ROW_HEIGHT);

        // Test normal value within bounds
        sheet.set_default_height(50.0);
        assert_eq!(sheet.defaults().1, 50.0);
    }

    #[test]
    fn test_square_grid_cells() {
        let mut sheet = SheetOffsets::default();

        // Set both column width and row height to the same value for square cells
        let square_size = 100.0;
        sheet.set_default_width(square_size);
        sheet.set_default_height(square_size);

        assert_eq!(sheet.defaults().0, square_size);
        assert_eq!(sheet.defaults().1, square_size);

        // Verify individual cells are square
        let screen_rect = sheet.screen_rect_cell_offsets(Rect::new(1, 1, 1, 1));
        assert_eq!(screen_rect.w, screen_rect.h);
    }
}
