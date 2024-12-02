use serde::{Deserialize, Serialize};

use super::{CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat, RenderSize};

pub mod sheet_formatting_col_row;
pub mod sheet_formatting_query;
pub mod sheet_formatting_set;

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
