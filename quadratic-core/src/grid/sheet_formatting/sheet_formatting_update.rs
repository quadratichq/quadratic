//! Updating sheet formatting.

use crate::grid::formats::SheetFormatUpdates;

use super::*;

impl SheetFormatting {
    pub fn apply_updates(&mut self, updates: &SheetFormatUpdates) -> SheetFormatUpdates {
        SheetFormatUpdates {
            align: updates
                .align
                .clone()
                .map(|value| self.align.set_from(value)),
            vertical_align: updates
                .vertical_align
                .clone()
                .map(|value| self.vertical_align.set_from(value)),
            wrap: updates.wrap.clone().map(|value| self.wrap.set_from(value)),
            numeric_format: updates
                .numeric_format
                .clone()
                .map(|value| self.numeric_format.set_from(value)),
            numeric_decimals: updates
                .numeric_decimals
                .clone()
                .map(|value| self.numeric_decimals.set_from(value)),
            numeric_commas: updates
                .numeric_commas
                .clone()
                .map(|value| self.numeric_commas.set_from(value)),
            bold: updates.bold.clone().map(|value| self.bold.set_from(value)),
            italic: updates
                .italic
                .clone()
                .map(|value| self.italic.set_from(value)),
            underline: updates
                .underline
                .clone()
                .map(|value| self.underline.set_from(value)),
            text_color: updates
                .text_color
                .clone()
                .map(|value| self.text_color.set_from(value)),
            date_time: updates
                .date_time
                .clone()
                .map(|value| self.date_time.set_from(value)),
            fill_color: updates
                .fill_color
                .clone()
                .map(|value| self.fill_color.set_from(value)),
            render_size: updates
                .render_size
                .clone()
                .map(|value| self.render_size.set_from(value)),
            strike_through: updates
                .strike_through
                .clone()
                .map(|value| self.strike_through.set_from(value)),
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_apply_updates() {
        let mut formats = SheetFormatting::default();
        let updates = SheetFormatUpdates::default();
        let new_updates = formats.apply_updates(&updates);
        assert_eq!(new_updates, updates);
    }
}
