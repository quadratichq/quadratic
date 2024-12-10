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
                .map(|value| {
                    self.align
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            vertical_align: updates
                .vertical_align
                .as_ref()
                .map(|value| {
                    self.vertical_align
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            wrap: updates
                .wrap
                .as_ref()
                .map(|value| {
                    self.wrap
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            numeric_format: updates
                .numeric_format
                .as_ref()
                .map(|value| {
                    self.numeric_format.set_from(
                        &value.map_ref(|value| value.as_ref().map(|value| value.clone().into())),
                    )
                })
                .map(|value| {
                    value.map_ref(|value| value.as_ref().map(|value| value.clone().into()))
                }),
            numeric_decimals: updates
                .numeric_decimals
                .as_ref()
                .map(|value| {
                    self.numeric_decimals
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            numeric_commas: updates
                .numeric_commas
                .as_ref()
                .map(|value| {
                    self.numeric_commas
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            bold: updates
                .bold
                .as_ref()
                .map(|value| {
                    self.bold
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            italic: updates
                .italic
                .as_ref()
                .map(|value| {
                    self.italic
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            underline: updates
                .underline
                .as_ref()
                .map(|value| {
                    self.underline
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
            text_color: updates
                .text_color
                .as_ref()
                .map(|value| {
                    self.text_color.set_from(
                        &value.map_ref(|value| value.as_ref().map(|value| value.clone().into())),
                    )
                })
                .map(|value| {
                    value.map_ref(|value| value.as_ref().map(|value| value.clone().into()))
                }),
            date_time: updates
                .date_time
                .as_ref()
                .map(|value| {
                    self.date_time.set_from(
                        &value.map_ref(|value| value.as_ref().map(|value| value.clone().into())),
                    )
                })
                .map(|value| {
                    value.map_ref(|value| value.as_ref().map(|value| value.clone().into()))
                }),
            fill_color: updates
                .fill_color
                .as_ref()
                .map(|value| {
                    self.fill_color.set_from(
                        &value.map_ref(|value| value.as_ref().map(|value| value.clone().into())),
                    )
                })
                .map(|value| {
                    value.map_ref(|value| value.as_ref().map(|value| value.clone().into()))
                }),
            render_size: updates
                .render_size
                .as_ref()
                .map(|value| {
                    self.render_size.set_from(
                        &value.map_ref(|value| value.as_ref().map(|value| value.clone().into())),
                    )
                })
                .map(|value| {
                    value.map_ref(|value| value.as_ref().map(|value| value.clone().into()))
                }),
            strike_through: updates
                .strike_through
                .as_ref()
                .map(|value| {
                    self.strike_through
                        .set_from(&value.map_ref(|value| value.map(|value| value.into())))
                })
                .map(|value| value.map_ref(|value| value.map(|value| value.into()))),
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
        self.render_size.translate_in_place(x, y);
        self.date_time.translate_in_place(x, y);
        self.underline.translate_in_place(x, y);
        self.strike_through.translate_in_place(x, y);
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
