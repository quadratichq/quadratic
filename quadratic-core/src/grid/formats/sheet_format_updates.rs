//! Used to store formatting changes to apply to an entire sheet.

use serde::{Deserialize, Serialize};

use crate::{
    grid::{CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat, RenderSize},
    A1Selection, Rect,
};

use super::FormatUpdate;

#[derive(Deserialize, Serialize, Default, Debug, Clone, Eq, PartialEq)]
pub struct SheetFormatUpdates {
    pub align: Option<Contiguous2D<Option<CellAlign>>>,
    pub vertical_align: Option<Contiguous2D<Option<CellVerticalAlign>>>,
    pub wrap: Option<Contiguous2D<Option<CellWrap>>>,
    pub numeric_format: Option<Contiguous2D<Option<NumericFormat>>>,
    pub numeric_decimals: Option<Contiguous2D<Option<i16>>>,
    pub numeric_commas: Option<Contiguous2D<Option<bool>>>,
    pub bold: Option<Contiguous2D<Option<bool>>>,
    pub italic: Option<Contiguous2D<Option<bool>>>,
    pub text_color: Option<Contiguous2D<Option<String>>>,
    pub fill_color: Option<Contiguous2D<Option<String>>>,
    pub render_size: Option<Contiguous2D<Option<RenderSize>>>,
    pub date_time: Option<Contiguous2D<Option<String>>>,
    pub underline: Option<Contiguous2D<Option<bool>>>,
    pub strike_through: Option<Contiguous2D<Option<bool>>>,
}
impl SheetFormatUpdates {
    /// Constructs a format update that applies the same formatting to every
    /// affected cell.
    pub fn from_selection(selection: &A1Selection, update: FormatUpdate) -> Self {
        Self {
            align: update
                .align
                .map(|update| Contiguous2D::<CellAlign>::new_from_selection(selection, update)),
            vertical_align: update.vertical_align.map(|update| {
                Contiguous2D::<CellVerticalAlign>::new_from_selection(selection, update)
            }),
            wrap: update
                .wrap
                .map(|update| Contiguous2D::<CellWrap>::new_from_selection(selection, update)),
            numeric_format: update
                .numeric_format
                .map(|update| Contiguous2D::<NumericFormat>::new_from_selection(selection, update)),
            numeric_decimals: update
                .numeric_decimals
                .map(|update| Contiguous2D::<i16>::new_from_selection(selection, update)),
            numeric_commas: update
                .numeric_commas
                .map(|update| Contiguous2D::<bool>::new_from_selection(selection, update)),
            bold: update
                .bold
                .map(|update| Contiguous2D::<bool>::new_from_selection(selection, update)),
            italic: update
                .italic
                .map(|update| Contiguous2D::<bool>::new_from_selection(selection, update)),
            text_color: update
                .text_color
                .map(|update| Contiguous2D::<String>::new_from_selection(selection, update)),
            fill_color: update
                .fill_color
                .map(|update| Contiguous2D::<String>::new_from_selection(selection, update)),
            render_size: update
                .render_size
                .map(|update| Contiguous2D::<RenderSize>::new_from_selection(selection, update)),
            date_time: update
                .date_time
                .map(|update| Contiguous2D::<String>::new_from_selection(selection, update)),
            underline: update
                .underline
                .map(|update| Contiguous2D::<bool>::new_from_selection(selection, update)),
            strike_through: update
                .strike_through
                .map(|update| Contiguous2D::<bool>::new_from_selection(selection, update)),
        }
    }

    /// Returns whether the format update intersects with the given rect.
    pub fn intersects(&self, rect: Rect) -> bool {
        self.align
            .as_ref()
            .is_some_and(|align| align.intersects(rect))
            || self
                .vertical_align
                .as_ref()
                .is_some_and(|vertical_align| vertical_align.intersects(rect))
            || self.wrap.as_ref().is_some_and(|wrap| wrap.intersects(rect))
            || self
                .numeric_format
                .as_ref()
                .is_some_and(|numeric_format| numeric_format.intersects(rect))
            || self
                .numeric_decimals
                .as_ref()
                .is_some_and(|numeric_decimals| numeric_decimals.intersects(rect))
            || self
                .numeric_commas
                .as_ref()
                .is_some_and(|numeric_commas| numeric_commas.intersects(rect))
            || self.bold.as_ref().is_some_and(|bold| bold.intersects(rect))
            || self
                .italic
                .as_ref()
                .is_some_and(|italic| italic.intersects(rect))
            || self
                .text_color
                .as_ref()
                .is_some_and(|text_color| text_color.intersects(rect))
            || self
                .fill_color
                .as_ref()
                .is_some_and(|fill_color| fill_color.intersects(rect))
            || self
                .render_size
                .as_ref()
                .is_some_and(|render_size| render_size.intersects(rect))
            || self
                .date_time
                .as_ref()
                .is_some_and(|date_time| date_time.intersects(rect))
            || self
                .underline
                .as_ref()
                .is_some_and(|underline| underline.intersects(rect))
            || self
                .strike_through
                .as_ref()
                .is_some_and(|strike_through| strike_through.intersects(rect))
    }

    /// Returns whether the format update is empty.
    pub fn is_default(&self) -> bool {
        self.align.is_none()
            && self.vertical_align.is_none()
            && self.wrap.is_none()
            && self.numeric_format.is_none()
            && self.numeric_decimals.is_none()
            && self.numeric_commas.is_none()
            && self.bold.is_none()
            && self.italic.is_none()
            && self.text_color.is_none()
            && self.fill_color.is_none()
            && self.render_size.is_none()
            && self.date_time.is_none()
            && self.underline.is_none()
            && self.strike_through.is_none()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_is_default() {
        let format = FormatUpdate::default();
        assert!(format.is_default());

        let format = FormatUpdate {
            align: Some(None),
            ..Default::default()
        };
        assert!(format.is_default());
    }
}
