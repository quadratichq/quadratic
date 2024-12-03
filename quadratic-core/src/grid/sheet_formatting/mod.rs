//! Provides all sheet formatting types and functionality.
//!
//! To get a value, use sheet.formats.<type>.get(Pos) or
//! sheet.formats.<type>.rect_values(Rect).
//!
//! For example: sheet.formats.bold.get(pos![A1]) or
//! sheet.formats.bold.rect_values(Rect::new(1, 1, 10, 10)).
//!
//! To set a value, use sheet.formats.<type>.set(pos![A1], Some(value)) or
//! sheet.formats.<type>.set_rect(x0, y0, None/Some(x1), None/Some(y1),
//! Some(value)).
//!
//! Note: if x1 or y1 are set to None, then it will add those values to
//! "infinity" for those columns, rows, or sheet (if both x and y are None).

use serde::{Deserialize, Serialize};

use super::{CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat, RenderSize};

pub mod sheet_formatting_col_row;
pub mod sheet_formatting_query;
pub mod sheet_formatting_update;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct SheetFormatting {
    pub align: Contiguous2D<CellAlign>,
    pub vertical_align: Contiguous2D<CellVerticalAlign>,
    pub wrap: Contiguous2D<CellWrap>,
    pub numeric_format: Contiguous2D<NumericFormat>,
    pub numeric_decimals: Contiguous2D<i16>,
    pub numeric_commas: Contiguous2D<bool>,
    pub bold: Contiguous2D<bool>,
    pub italic: Contiguous2D<bool>,
    pub text_color: Contiguous2D<String>,
    pub fill_color: Contiguous2D<String>,
    pub render_size: Contiguous2D<RenderSize>,
    pub date_time: Contiguous2D<String>,
    pub underline: Contiguous2D<bool>,
    pub strike_through: Contiguous2D<bool>,
}

impl SheetFormatting {
    // /// Sets all formatting values for a cell.
    // pub fn set(&mut self, pos: Pos, format: Option<Format>) -> Option<Format> {
    //     self.0.set(pos, format.filter(|f| !f.is_default()))
    // }

    // /// Removes a column and returns the old values.
    // pub fn remove_column(&mut self, column: i64) -> ContiguousBlocks<Format> {
    //     self.0.remove_column(column)
    // }

    // /// Inserts a column and populates it with values.
    // pub fn restore_column(&mut self, column: i64, values: ContiguousBlocks<Format>) {
    //     self.0.restore_column(column, Some(values));
    // }

    // /// Inserts a column and optionally populates it based on the column before
    // /// or after it.
    // pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
    //     self.0.insert_column(column, copy_formats);
    // }

    // /// Removes a row and returns the old values.
    // pub fn remove_row(&mut self, row: i64) -> ContiguousBlocks<Format> {
    //     self.0.remove_row(row)
    // }

    // /// Inserts a row and populates it with values.
    // pub fn restore_row(&mut self, row: i64, values: ContiguousBlocks<Format>) {
    //     self.0.restore_row(row, Some(values));
    // }

    // /// Inserts a row and optionally populates it based on the row before or
    // /// after it.
    // pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
    //     self.0.insert_row(row, copy_formats);
    // }
}
