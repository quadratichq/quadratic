//! Updates to sheet formatting.

use crate::grid::formats::SheetFormatUpdates;

use super::*;

impl SheetFormatting {
    /// Applies updates to the sheet formatting.
    pub fn apply_updates(&mut self, updates: &SheetFormatUpdates) -> SheetFormatUpdates {
        SheetFormatUpdates {
            align: updates
                .align
                .as_ref()
                .map(|value| self.align.set_from(value)),
            vertical_align: updates
                .vertical_align
                .as_ref()
                .map(|value| self.vertical_align.set_from(value)),
            wrap: updates.wrap.as_ref().map(|value| self.wrap.set_from(value)),
            numeric_format: updates
                .numeric_format
                .as_ref()
                .map(|value| self.numeric_format.set_from(value)),
            numeric_decimals: updates
                .numeric_decimals
                .as_ref()
                .map(|value| self.numeric_decimals.set_from(value)),
            numeric_commas: updates
                .numeric_commas
                .as_ref()
                .map(|value| self.numeric_commas.set_from(value)),
            bold: updates.bold.as_ref().map(|value| self.bold.set_from(value)),
            italic: updates
                .italic
                .as_ref()
                .map(|value| self.italic.set_from(value)),
            underline: updates
                .underline
                .as_ref()
                .map(|value| self.underline.set_from(value)),
            text_color: updates
                .text_color
                .as_ref()
                .map(|value| self.text_color.set_from(value)),
            date_time: updates
                .date_time
                .as_ref()
                .map(|value| self.date_time.set_from(value)),
            fill_color: updates
                .fill_color
                .as_ref()
                .map(|value| self.fill_color.set_from(value)),
            render_size: updates
                .render_size
                .as_ref()
                .map(|value| self.render_size.set_from(value)),
            strike_through: updates
                .strike_through
                .as_ref()
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
