use crate::{grid::offsets::Offsets, THUMBNAIL_WIDTH};
use crate::{Pos, Rect, ScreenRect, THUMBNAIL_HEIGHT};
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

    thumbnail: (i64, i64),

    #[serde(skip_serializing, skip_deserializing)]
    transient_resize: Option<TransientResize>,
}

impl Default for SheetOffsets {
    fn default() -> Self {
        let mut offsets = SheetOffsets {
            column_widths: Offsets::new(crate::DEFAULT_COLUMN_WIDTH),
            row_heights: Offsets::new(crate::DEFAULT_ROW_HEIGHT),
            thumbnail: (0, 0),
            transient_resize: None,
        };
        offsets.calculate_thumbnail();
        offsets
    }
}

pub type OffsetWidthHeight = (Vec<(i64, f64)>, Vec<(i64, f64)>);

impl SheetOffsets {
    pub fn new(column_widths: Offsets, row_heights: Offsets) -> Self {
        let mut offsets = SheetOffsets {
            column_widths,
            row_heights,
            thumbnail: (0, 0),
            transient_resize: None,
        };
        offsets.calculate_thumbnail();
        offsets
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
        let mut offsets = SheetOffsets {
            column_widths: Offsets::from_iter(
                crate::DEFAULT_COLUMN_WIDTH,
                offsets.0.iter().copied(),
            ),
            row_heights: Offsets::from_iter(crate::DEFAULT_ROW_HEIGHT, offsets.1.iter().copied()),
            thumbnail: (0, 0),
            transient_resize: None,
        };
        offsets.calculate_thumbnail();
        offsets
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
        let old = self.column_widths.set_size(x, width);
        self.calculate_thumbnail();
        old
    }
    /// Sets the height of a row and returns the old height.
    pub fn set_row_height(&mut self, y: i64, height: f64) -> f64 {
        let old = self.row_heights.set_size(y, height);
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
}
