//! Updates to sheet formatting.

use crate::grid::formats::{SheetFormatUpdates, SheetFormatUpdatesType};

use super::*;

use std::fmt::Debug;

impl SheetFormatting {
    fn apply_updates_item<T>(
        updates: &SheetFormatUpdatesType<T>,
        item: &mut SheetFormattingType<T>,
    ) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        updates
            .as_ref()
            .map(|value| {
                item.set_from(
                    &value.map_ref(|value| value.as_ref().map(|value| value.clone().into())),
                )
            })
            .map(|value| value.map_ref(|value| value.as_ref().map(|value| value.clone().into())))
    }

    /// Applies updates to the sheet formatting.
    pub fn apply_updates(&mut self, updates: &SheetFormatUpdates) -> SheetFormatUpdates {
        SheetFormatUpdates {
            align: Self::apply_updates_item(&updates.align, &mut self.align),
            vertical_align: Self::apply_updates_item(
                &updates.vertical_align,
                &mut self.vertical_align,
            ),
            wrap: Self::apply_updates_item(&updates.wrap, &mut self.wrap),
            numeric_format: Self::apply_updates_item(
                &updates.numeric_format,
                &mut self.numeric_format,
            ),
            numeric_decimals: Self::apply_updates_item(
                &updates.numeric_decimals,
                &mut self.numeric_decimals,
            ),
            numeric_commas: Self::apply_updates_item(
                &updates.numeric_commas,
                &mut self.numeric_commas,
            ),
            bold: Self::apply_updates_item(&updates.bold, &mut self.bold),
            italic: Self::apply_updates_item(&updates.italic, &mut self.italic),
            text_color: Self::apply_updates_item(&updates.text_color, &mut self.text_color),
            date_time: Self::apply_updates_item(&updates.date_time, &mut self.date_time),
            fill_color: Self::apply_updates_item(&updates.fill_color, &mut self.fill_color),
            underline: Self::apply_updates_item(&updates.underline, &mut self.underline),
            strike_through: Self::apply_updates_item(
                &updates.strike_through,
                &mut self.strike_through,
            ),
            font_size: Self::apply_updates_item(&updates.font_size, &mut self.font_size),
        }
    }

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
        self.date_time.translate_in_place(x, y);
        self.underline.translate_in_place(x, y);
        self.strike_through.translate_in_place(x, y);
        self.font_size.translate_in_place(x, y);
    }
}

#[cfg(test)]
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
