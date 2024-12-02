use super::*;

use crate::{
    grid::{formatting::DateTimeFormatting, Format},
    Pos, Rect,
};

impl SheetFormatting {
    /// Returns the maximum value in the column for which formatting exists.
    pub fn column_max(&self, column: i64) -> Option<i64> {
        [
            self.align.column_max(column),
            self.vertical_align.column_max(column),
            self.wrap.column_max(column),
            self.numeric_format.column_max(column),
            self.numeric_decimals.column_max(column),
            self.numeric_commas.column_max(column),
            self.bold.column_max(column),
            self.italic.column_max(column),
            self.text_color.column_max(column),
            self.fill_color.column_max(column),
            self.render_size.column_max(column),
            self.date_time.column_max(column),
            self.underline.column_max(column),
            self.strike_through.column_max(column),
        ]
        .iter()
        .filter_map(|&x| x)
        .max()
    }

    /// Returns all formatting values for a cell.
    pub fn get(&self, pos: Pos) -> Option<Format> {
        let format = Format {
            align: self.align.get(pos).copied(),
            vertical_align: self.vertical_align.get(pos).copied(),
            wrap: self.wrap.get(pos).copied(),
            numeric_format: self.numeric_format.get(pos).cloned(),
            numeric_decimals: self.numeric_decimals.get(pos).copied(),
            numeric_commas: self.numeric_commas.get(pos).copied(),
            bold: self.bold.get(pos).copied(),
            italic: self.italic.get(pos).copied(),
            text_color: self.text_color.get(pos).cloned(),
            fill_color: self.fill_color.get(pos).cloned(),
            render_size: self.render_size.get(pos).cloned(),
            date_time: self.date_time.get(pos).cloned(),
            underline: self.underline.get(pos).copied(),
            strike_through: self.strike_through.get(pos).copied(),
        };
        if format.is_default() {
            None
        } else {
            Some(format)
        }
    }

    /// Returns the alignment values for a rectangle, where each entry in the
    /// Vec corresponds to a CellAlign.
    pub fn get_align(&self, rect: Rect) -> Vec<Option<CellAlign>> {
        self.align.rect_values(rect)
    }

    pub fn get_vertical_align(&self, rect: Rect) -> Vec<Option<CellVerticalAlign>> {
        self.vertical_align.rect_values(rect)
    }

    pub fn get_wrap(&self, rect: Rect) -> Vec<Option<CellWrap>> {
        self.wrap.rect_values(rect)
    }

    pub fn get_numeric_format(&self, rect: Rect) -> Vec<Option<NumericFormat>> {
        self.numeric_format.rect_values(rect)
    }

    pub fn get_numeric_decimals(&self, rect: Rect) -> Vec<Option<i16>> {
        self.numeric_decimals.rect_values(rect)
    }

    pub fn get_numeric_commas(&self, rect: Rect) -> Vec<Option<bool>> {
        self.numeric_commas.rect_values(rect)
    }

    pub fn get_bold(&self, rect: Rect) -> Vec<Option<bool>> {
        self.bold.rect_values(rect)
    }

    pub fn get_italic(&self, rect: Rect) -> Vec<Option<bool>> {
        self.italic.rect_values(rect)
    }

    pub fn get_text_color(&self, rect: Rect) -> Vec<Option<String>> {
        self.text_color.rect_values(rect)
    }

    pub fn get_fill_color(&self, rect: Rect) -> Vec<Option<String>> {
        self.fill_color.rect_values(rect)
    }

    pub fn get_render_size(&self, rect: Rect) -> Vec<Option<RenderSize>> {
        self.render_size.rect_values(rect)
    }

    pub fn get_date_time(&self, rect: Rect) -> Vec<Option<String>> {
        self.date_time.rect_values(rect)
    }

    pub fn get_underline(&self, rect: Rect) -> Vec<Option<bool>> {
        self.underline.rect_values(rect)
    }

    pub fn get_strike_through(&self, rect: Rect) -> Vec<Option<bool>> {
        self.strike_through.rect_values(rect)
    }
}
