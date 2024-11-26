use serde::{Deserialize, Serialize};

use super::{
    CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, ContiguousBlocks, Format, NumericFormat,
    RenderSize,
};
use crate::{CopyFormats, Pos};

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
#[serde(default)]
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
    /// Returns the maximum value in the column for which formatting exists.
    pub fn column_max(&self, column: u64) -> Option<u64> {
        itertools::max([
            self.align.column_max(column)?,
            self.vertical_align.column_max(column)?,
            self.wrap.column_max(column)?,
            self.numeric_format.column_max(column)?,
            self.numeric_decimals.column_max(column)?,
            self.bold.column_max(column)?,
            self.italic.column_max(column)?,
            self.text_color.column_max(column)?,
            self.fill_color.column_max(column)?,
            self.render_size.column_max(column)?,
            self.date_time.column_max(column)?,
            self.underline.column_max(column)?,
            self.strike_through.column_max(column)?,
        ])
    }

    /// Returns all formatting values for a cell.
    pub fn get(&self, pos: Pos) -> Option<Format> {
        let format = Format {
            align: self.align.get(pos).cloned(),
            vertical_align: self.vertical_align.get(pos).cloned(),
            wrap: self.wrap.get(pos).cloned(),
            numeric_format: self.numeric_format.get(pos).cloned(),
            numeric_decimals: self.numeric_decimals.get(pos).cloned(),
            numeric_commas: self.numeric_commas.get(pos).cloned(),
            bold: self.bold.get(pos).cloned(),
            italic: self.italic.get(pos).cloned(),
            text_color: self.text_color.get(pos).cloned(),
            fill_color: self.fill_color.get(pos).cloned(),
            render_size: self.render_size.get(pos).cloned(),
            date_time: self.date_time.get(pos).cloned(),
            underline: self.underline.get(pos).cloned(),
            strike_through: self.strike_through.get(pos).cloned(),
        };
        if format.is_default() {
            None
        } else {
            Some(format)
        }
    }

    /// Removes a column and returns the old values.
    pub fn remove_column(&mut self, column: u64) -> RemovedSliceFormatting {
        RemovedSliceFormatting {
            align: self.align.remove_column(column),
            vertical_align: self.vertical_align.remove_column(column),
            wrap: self.wrap.remove_column(column),
            numeric_format: self.numeric_format.remove_column(column),
            numeric_decimals: self.numeric_decimals.remove_column(column),
            numeric_commas: self.numeric_commas.remove_column(column),
            bold: self.bold.remove_column(column),
            italic: self.italic.remove_column(column),
            text_color: self.text_color.remove_column(column),
            fill_color: self.fill_color.remove_column(column),
            render_size: self.render_size.remove_column(column),
            date_time: self.date_time.remove_column(column),
            underline: self.underline.remove_column(column),
            strike_through: self.strike_through.remove_column(column),
        }
    }

    /// Inserts a column and populates it with values.
    pub fn restore_column(&mut self, column: u64, values: RemovedSliceFormatting) {
        // destructure because this will compile-error if we add a field
        let RemovedSliceFormatting {
            align,
            vertical_align,
            wrap,
            numeric_format,
            numeric_decimals,
            numeric_commas,
            bold,
            italic,
            text_color,
            fill_color,
            render_size,
            date_time,
            underline,
            strike_through,
        } = values;

        self.align.restore_column(column, Some(align));
        self.vertical_align
            .restore_column(column, Some(vertical_align));
        self.wrap.restore_column(column, Some(wrap));
        self.numeric_format
            .restore_column(column, Some(numeric_format));
        self.numeric_decimals
            .restore_column(column, Some(numeric_decimals));
        self.numeric_commas
            .restore_column(column, Some(numeric_commas));
        self.bold.restore_column(column, Some(bold));
        self.italic.restore_column(column, Some(italic));
        self.text_color.restore_column(column, Some(text_color));
        self.fill_color.restore_column(column, Some(fill_color));
        self.render_size.restore_column(column, Some(render_size));
        self.date_time.restore_column(column, Some(date_time));
        self.underline.restore_column(column, Some(underline));
        self.strike_through
            .restore_column(column, Some(strike_through));
    }

    /// Inserts a column and optionally populates it based on the column before
    /// or after it.
    pub fn insert_column(&mut self, column: u64, copy_formats: CopyFormats) {
        // destructure because this will compile-error if we add a field
        let Self {
            align,
            vertical_align,
            wrap,
            numeric_format,
            numeric_decimals,
            numeric_commas,
            bold,
            italic,
            text_color,
            fill_color,
            render_size,
            date_time,
            underline,
            strike_through,
        } = self;

        align.insert_column(column, copy_formats);
        vertical_align.insert_column(column, copy_formats);
        wrap.insert_column(column, copy_formats);
        numeric_format.insert_column(column, copy_formats);
        numeric_decimals.insert_column(column, copy_formats);
        numeric_commas.insert_column(column, copy_formats);
        bold.insert_column(column, copy_formats);
        italic.insert_column(column, copy_formats);
        text_color.insert_column(column, copy_formats);
        fill_color.insert_column(column, copy_formats);
        render_size.insert_column(column, copy_formats);
        date_time.insert_column(column, copy_formats);
        underline.insert_column(column, copy_formats);
        strike_through.insert_column(column, copy_formats);
    }

    /// Removes a row and returns the old values.
    pub fn remove_row(&mut self, row: u64) -> RemovedSliceFormatting {
        RemovedSliceFormatting {
            align: self.align.remove_row(row),
            vertical_align: self.vertical_align.remove_row(row),
            wrap: self.wrap.remove_row(row),
            numeric_format: self.numeric_format.remove_row(row),
            numeric_decimals: self.numeric_decimals.remove_row(row),
            numeric_commas: self.numeric_commas.remove_row(row),
            bold: self.bold.remove_row(row),
            italic: self.italic.remove_row(row),
            text_color: self.text_color.remove_row(row),
            fill_color: self.fill_color.remove_row(row),
            render_size: self.render_size.remove_row(row),
            date_time: self.date_time.remove_row(row),
            underline: self.underline.remove_row(row),
            strike_through: self.strike_through.remove_row(row),
        }
    }

    /// Inserts a row and populates it with values.
    pub fn restore_row(&mut self, row: u64, values: RemovedSliceFormatting) {
        // destructure because this will compile-error if we add a field
        let RemovedSliceFormatting {
            align,
            vertical_align,
            wrap,
            numeric_format,
            numeric_decimals,
            numeric_commas,
            bold,
            italic,
            text_color,
            fill_color,
            render_size,
            date_time,
            underline,
            strike_through,
        } = values;

        self.align.restore_row(row, Some(align));
        self.vertical_align.restore_row(row, Some(vertical_align));
        self.wrap.restore_row(row, Some(wrap));
        self.numeric_format.restore_row(row, Some(numeric_format));
        self.numeric_decimals
            .restore_row(row, Some(numeric_decimals));
        self.numeric_commas.restore_row(row, Some(numeric_commas));
        self.bold.restore_row(row, Some(bold));
        self.italic.restore_row(row, Some(italic));
        self.text_color.restore_row(row, Some(text_color));
        self.fill_color.restore_row(row, Some(fill_color));
        self.render_size.restore_row(row, Some(render_size));
        self.date_time.restore_row(row, Some(date_time));
        self.underline.restore_row(row, Some(underline));
        self.strike_through.restore_row(row, Some(strike_through));
    }

    /// Inserts a row and optionally populates it based on the row before or
    /// after it.
    pub fn insert_row(&mut self, row: u64, copy_formats: CopyFormats) {
        // destructure because this will compile-error if we add a field
        let Self {
            align,
            vertical_align,
            wrap,
            numeric_format,
            numeric_decimals,
            numeric_commas,
            bold,
            italic,
            text_color,
            fill_color,
            render_size,
            date_time,
            underline,
            strike_through,
        } = self;

        align.insert_row(row, copy_formats);
        vertical_align.insert_row(row, copy_formats);
        wrap.insert_row(row, copy_formats);
        numeric_format.insert_row(row, copy_formats);
        numeric_decimals.insert_row(row, copy_formats);
        numeric_commas.insert_row(row, copy_formats);
        bold.insert_row(row, copy_formats);
        italic.insert_row(row, copy_formats);
        text_color.insert_row(row, copy_formats);
        fill_color.insert_row(row, copy_formats);
        render_size.insert_row(row, copy_formats);
        date_time.insert_row(row, copy_formats);
        underline.insert_row(row, copy_formats);
        strike_through.insert_row(row, copy_formats);
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct RemovedSliceFormatting {
    pub align: ContiguousBlocks<CellAlign>,
    pub vertical_align: ContiguousBlocks<CellVerticalAlign>,
    pub wrap: ContiguousBlocks<CellWrap>,
    pub numeric_format: ContiguousBlocks<NumericFormat>,
    pub numeric_decimals: ContiguousBlocks<i16>,
    pub numeric_commas: ContiguousBlocks<bool>,
    pub bold: ContiguousBlocks<bool>,
    pub italic: ContiguousBlocks<bool>,
    pub text_color: ContiguousBlocks<String>,
    pub fill_color: ContiguousBlocks<String>,
    pub render_size: ContiguousBlocks<RenderSize>,
    pub date_time: ContiguousBlocks<String>,
    pub underline: ContiguousBlocks<bool>,
    pub strike_through: ContiguousBlocks<bool>,
}
