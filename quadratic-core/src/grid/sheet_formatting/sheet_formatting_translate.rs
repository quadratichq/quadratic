//! Updates to sheet formatting.

use super::SheetFormatting;

impl SheetFormatting {
    /// Applies updates to the sheet formatting.
    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.align.translate_in_place(x, y);
        self.vertical_align.translate_in_place(x, y);
        self.wrap.translate_in_place(x, y);
        self.numeric_format.translate_in_place(x, y);
        self.numeric_decimals.translate_in_place(x, y);
        self.numeric_commas.translate_in_place(x, y);
        self.bold.translate_in_place(x, y);
        self.italic.translate_in_place(x, y);
        self.text_color.translate_in_place(x, y);
        self.fill_color.translate_in_place(x, y);
        self.render_size.translate_in_place(x, y);
        self.date_time.translate_in_place(x, y);
        self.underline.translate_in_place(x, y);
        self.strike_through.translate_in_place(x, y);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {}
