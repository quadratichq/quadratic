use crate::grid::offsets::Offsets;
use crate::ScreenRect;
use serde::{Deserialize, Serialize};
use std::ops::Range;
use wasm_bindgen::prelude::wasm_bindgen;

use self::{resize_transient::TransientResize, sheet_offsets_wasm::OffsetsSizeChanges};

pub mod resize_transient;
pub mod sheet_offsets_wasm;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetOffsets {
    column_widths: Offsets,
    row_heights: Offsets,

    #[serde(skip_serializing, skip_deserializing)]
    transient_resize: Option<TransientResize>,
}

impl Default for SheetOffsets {
    fn default() -> Self {
        SheetOffsets {
            column_widths: Offsets::new(crate::DEFAULT_COLUMN_WIDTH),
            row_heights: Offsets::new(crate::DEFAULT_ROW_HEIGHT),

            transient_resize: None,
        }
    }
}

pub type OffsetWidthHeight = (Vec<(i64, f64)>, Vec<(i64, f64)>);

impl SheetOffsets {
    pub fn new(column_widths: Offsets, row_heights: Offsets) -> Self {
        SheetOffsets {
            column_widths,
            row_heights,
            transient_resize: None,
        }
    }

    /// exports offsets to a GridFile
    pub fn export(&self) -> OffsetWidthHeight {
        (
            self.column_widths.iter_sizes().collect(),
            self.row_heights.iter_sizes().collect(),
        )
    }

    /// import offsets from a GridFile
    pub fn import(offsets: &OffsetWidthHeight) -> Self {
        SheetOffsets {
            column_widths: Offsets::from_iter(
                crate::DEFAULT_COLUMN_WIDTH,
                offsets.0.iter().copied(),
            ),
            row_heights: Offsets::from_iter(crate::DEFAULT_ROW_HEIGHT, offsets.1.iter().copied()),
            transient_resize: None,
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

    /// gets a column's position and size
    pub fn column_position_size(&self, column: i64) -> (f64, f64) {
        let xs: Vec<f64> = self
            .column_widths
            .iter_offsets(Range {
                start: column,
                end: column + 2,
            })
            .collect();
        let x1 = *xs.first().unwrap();
        let x2 = *xs.last().unwrap();
        (x1, x2 - x1)
    }

    /// gets a row's position and size
    pub fn row_position_size(&self, row: i64) -> (f64, f64) {
        let ys: Vec<f64> = self
            .row_heights
            .iter_offsets(Range {
                start: row,
                end: row + 2,
            })
            .collect();
        let y1 = *ys.first().unwrap();
        let y2 = *ys.last().unwrap();
        (y1, y2 - y1)
    }

    /// get the offset rect from a cell
    pub fn cell_offsets(&self, column: i64, row: i64) -> ScreenRect {
        let (x, w) = self.column_position_size(column);
        let (y, h) = self.row_position_size(row);
        ScreenRect { x, y, w, h }
    }

    pub fn changes(&self, sheet_offsets: &SheetOffsets) -> OffsetsSizeChanges {
        OffsetsSizeChanges::new(
            self.column_widths.changes(&sheet_offsets.column_widths),
            self.row_heights.changes(&sheet_offsets.row_heights),
        )
    }

    /// calculates the number of columns and rows that are visible in a given width and height starting from 0,0
    /// (used for thumbnail generation)
    pub fn visible_cols_rows(&self, w: u32, h: u32) -> (u32, u32) {
        let mut x = 0;
        let mut y = 0;
        let mut width = 0.0;
        let mut height = 0.0;
        while width < w as f64 {
            width += self.column_width(x as i64);
            x += 1;
        }
        while height < h as f64 {
            height += self.row_height(y as i64);
            y += 1;
        }
        (x, y)
    }
}
