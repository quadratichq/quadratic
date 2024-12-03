use super::*;

use crate::{
    grid::{formats::format_update::SheetFormatUpdates, SheetId},
    CopyFormats,
};

impl SheetFormatting {
    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
        self.align.insert_column(column, copy_formats);
        self.vertical_align.insert_column(column, copy_formats);
        self.wrap.insert_column(column, copy_formats);
        self.numeric_format.insert_column(column, copy_formats);
        self.numeric_decimals.insert_column(column, copy_formats);
        self.numeric_commas.insert_column(column, copy_formats);
        self.bold.insert_column(column, copy_formats);
        self.italic.insert_column(column, copy_formats);
        self.text_color.insert_column(column, copy_formats);
        self.fill_color.insert_column(column, copy_formats);
        self.render_size.insert_column(column, copy_formats);
        self.date_time.insert_column(column, copy_formats);
        self.underline.insert_column(column, copy_formats);
        self.strike_through.insert_column(column, copy_formats);
    }

    pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
        self.align.insert_row(row, copy_formats);
        self.vertical_align.insert_row(row, copy_formats);
        self.wrap.insert_row(row, copy_formats);
        self.numeric_format.insert_row(row, copy_formats);
        self.numeric_decimals.insert_row(row, copy_formats);
        self.numeric_commas.insert_row(row, copy_formats);
        self.bold.insert_row(row, copy_formats);
        self.italic.insert_row(row, copy_formats);
        self.text_color.insert_row(row, copy_formats);
        self.fill_color.insert_row(row, copy_formats);
        self.render_size.insert_row(row, copy_formats);
        self.date_time.insert_row(row, copy_formats);
        self.underline.insert_row(row, copy_formats);
        self.strike_through.insert_row(row, copy_formats);
    }

    pub fn remove_column(&mut self, _sheet_id: SheetId, _column: i64) -> SheetFormatUpdates {
        todo!()
        // SheetFormatUpdates {
        //     sheet_id,
        //     align: self.align.remove_column(column),
        //     vertical_align: self.vertical_align.remove_column(column),
        //     wrap: self.wrap.remove_column(column),
        //     numeric_format: self.numeric_format.remove_column(column),
        //     numeric_decimals: self.numeric_decimals.remove_column(column),
        //     numeric_commas: self.numeric_commas.remove_column(column),
        //     bold: self.bold.remove_column(column),
        //     italic: self.italic.remove_column(column),
        //     text_color: self.text_color.remove_column(column),
        //     fill_color: self.fill_color.remove_column(column),
        //     render_size: self.render_size.remove_column(column),
        //     date_time: self.date_time.remove_column(column),
        //     underline: self.underline.remove_column(column),
        //     strike_through: self.strike_through.remove_column(column),
        // }
    }

    pub fn remove_row(&mut self, _sheet_id: SheetId, _row: i64) -> SheetFormatUpdates {
        todo!()
        // SheetFormatUpdates {
        //     sheet_id,
        //     align: self.align.remove_row(row),
        //     vertical_align: self.vertical_align.remove_row(row),
        //     wrap: self.wrap.remove_row(row),
        //     numeric_format: self.numeric_format.remove_row(row),
        //     numeric_decimals: self.numeric_decimals.remove_row(row),
        //     numeric_commas: self.numeric_commas.remove_row(row),
        //     bold: self.bold.remove_row(row),
        //     italic: self.italic.remove_row(row),
        //     text_color: self.text_color.remove_row(row),
        //     fill_color: self.fill_color.remove_row(row),
        //     render_size: self.render_size.remove_row(row),
        //     date_time: self.date_time.remove_row(row),
        //     underline: self.underline.remove_row(row),
        //     strike_through: self.strike_through.remove_row(row),
        // }
    }
}
