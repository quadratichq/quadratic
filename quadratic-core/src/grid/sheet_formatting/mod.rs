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
    pub align: Contiguous2D<Option<CellAlign>>,
    pub vertical_align: Contiguous2D<Option<CellVerticalAlign>>,
    pub wrap: Contiguous2D<Option<CellWrap>>,
    pub numeric_format: Contiguous2D<Option<NumericFormat>>,
    pub numeric_decimals: Contiguous2D<Option<i16>>,
    pub numeric_commas: Contiguous2D<bool>,
    pub bold: Contiguous2D<bool>,
    pub italic: Contiguous2D<bool>,
    pub text_color: Contiguous2D<Option<String>>,
    pub fill_color: Contiguous2D<Option<String>>,
    pub render_size: Contiguous2D<Option<RenderSize>>,
    pub date_time: Contiguous2D<Option<String>>,
    pub underline: Contiguous2D<bool>,
    pub strike_through: Contiguous2D<bool>,
}
