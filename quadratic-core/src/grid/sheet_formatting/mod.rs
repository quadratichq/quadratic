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

use super::{CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat};

pub mod sheet_formatting_clipboard;
pub mod sheet_formatting_col_row;
pub mod sheet_formatting_query;
pub mod sheet_formatting_update;

pub type SheetFormattingType<T> = Contiguous2D<Option<T>>;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct SheetFormatting {
    pub(crate) align: SheetFormattingType<CellAlign>,
    pub(crate) vertical_align: SheetFormattingType<CellVerticalAlign>,
    pub(crate) wrap: SheetFormattingType<CellWrap>,
    pub(crate) numeric_format: SheetFormattingType<NumericFormat>,
    pub(crate) numeric_decimals: SheetFormattingType<i16>,
    pub(crate) numeric_commas: SheetFormattingType<bool>,
    pub(crate) bold: SheetFormattingType<bool>,
    pub(crate) italic: SheetFormattingType<bool>,
    pub(crate) text_color: SheetFormattingType<String>,
    pub(crate) fill_color: SheetFormattingType<String>,
    pub(crate) date_time: SheetFormattingType<String>,
    pub(crate) underline: SheetFormattingType<bool>,
    pub(crate) strike_through: SheetFormattingType<bool>,
}

impl SheetFormatting {
    pub(crate) fn is_all_default(&self) -> bool {
        self.align.is_all_default()
            && self.vertical_align.is_all_default()
            && self.wrap.is_all_default()
            && self.numeric_format.is_all_default()
            && self.numeric_decimals.is_all_default()
            && self.numeric_commas.is_all_default()
            && self.bold.is_all_default()
            && self.italic.is_all_default()
            && self.text_color.is_all_default()
            && self.fill_color.is_all_default()
            && self.date_time.is_all_default()
            && self.underline.is_all_default()
            && self.strike_through.is_all_default()
    }
}
