//! Used to store formatting changes to apply to an entire sheet.

use serde::{Deserialize, Serialize};
use std::fmt::Debug;

use crate::{
    clear_option::ClearOption,
    grid::{CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat, RenderSize},
    A1Selection, Pos, Rect,
};

use super::FormatUpdate;

pub type SheetFormatUpdatesType<T> = Option<Contiguous2D<Option<ClearOption<T>>>>;

#[derive(Deserialize, Serialize, Default, Debug, Clone, Eq, PartialEq)]
pub struct SheetFormatUpdates {
    pub align: SheetFormatUpdatesType<CellAlign>,
    pub vertical_align: SheetFormatUpdatesType<CellVerticalAlign>,
    pub wrap: SheetFormatUpdatesType<CellWrap>,
    pub numeric_format: SheetFormatUpdatesType<NumericFormat>,
    pub numeric_decimals: SheetFormatUpdatesType<i16>,
    pub numeric_commas: SheetFormatUpdatesType<bool>,
    pub bold: SheetFormatUpdatesType<bool>,
    pub italic: SheetFormatUpdatesType<bool>,
    pub text_color: SheetFormatUpdatesType<String>,
    pub fill_color: SheetFormatUpdatesType<String>,
    pub render_size: SheetFormatUpdatesType<RenderSize>,
    pub date_time: SheetFormatUpdatesType<String>,
    pub underline: SheetFormatUpdatesType<bool>,
    pub strike_through: SheetFormatUpdatesType<bool>,
}

impl SheetFormatUpdates {
    fn apply_selection<T>(
        selection: &A1Selection,
        value: Option<Option<T>>,
    ) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        Contiguous2D::new_from_opt_selection(selection, value)
            .map(|c| c.map_ref(|c| c.as_ref().map(Into::into)))
    }

    /// Constructs a format update that applies the same formatting to every
    /// affected cell.
    ///
    /// The mapping is used to turn Option<Option<T>> into
    /// Option<ClearOption<T>> so it properly serializes.
    pub fn from_selection(selection: &A1Selection, update: FormatUpdate) -> Self {
        Self {
            align: Self::apply_selection(selection, update.align),
            vertical_align: Self::apply_selection(selection, update.vertical_align),
            wrap: Self::apply_selection(selection, update.wrap),
            numeric_format: Self::apply_selection(selection, update.numeric_format),
            numeric_decimals: Self::apply_selection(selection, update.numeric_decimals),
            numeric_commas: Self::apply_selection(selection, update.numeric_commas),
            bold: Self::apply_selection(selection, update.bold),
            italic: Self::apply_selection(selection, update.italic),
            text_color: Self::apply_selection(selection, update.text_color),
            fill_color: Self::apply_selection(selection, update.fill_color),
            render_size: Self::apply_selection(selection, update.render_size),
            date_time: Self::apply_selection(selection, update.date_time),
            underline: Self::apply_selection(selection, update.underline),
            strike_through: Self::apply_selection(selection, update.strike_through),
        }
    }

    fn item_intersects<T>(item: &SheetFormatUpdatesType<T>, rect: Rect) -> bool
    where
        T: Clone + Debug + PartialEq,
    {
        item.as_ref().is_some_and(|item| item.intersects(rect))
    }

    /// Returns whether the format update intersects with the given rect.
    pub fn intersects(&self, rect: Rect) -> bool {
        Self::item_intersects(&self.align, rect)
            || Self::item_intersects(&self.vertical_align, rect)
            || Self::item_intersects(&self.wrap, rect)
            || Self::item_intersects(&self.numeric_format, rect)
            || Self::item_intersects(&self.numeric_decimals, rect)
            || Self::item_intersects(&self.numeric_commas, rect)
            || Self::item_intersects(&self.bold, rect)
            || Self::item_intersects(&self.italic, rect)
            || Self::item_intersects(&self.text_color, rect)
            || Self::item_intersects(&self.fill_color, rect)
            || Self::item_intersects(&self.render_size, rect)
            || Self::item_intersects(&self.date_time, rect)
            || Self::item_intersects(&self.underline, rect)
            || Self::item_intersects(&self.strike_through, rect)
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

    fn set_format_cell_item<T>(
        pos: Pos,
        item: &mut SheetFormatUpdatesType<T>,
        value: Option<Option<T>>,
    ) where
        T: Clone + Debug + PartialEq,
    {
        value.map(|value| {
            item.get_or_insert_with(Default::default)
                .set(pos, Some(value.into()))
        });
    }

    pub fn set_format_cell(&mut self, pos: Pos, update: FormatUpdate) {
        Self::set_format_cell_item(pos, &mut self.align, update.align);
        Self::set_format_cell_item(pos, &mut self.vertical_align, update.vertical_align);
        Self::set_format_cell_item(pos, &mut self.wrap, update.wrap);
        Self::set_format_cell_item(pos, &mut self.numeric_format, update.numeric_format);
        Self::set_format_cell_item(pos, &mut self.numeric_decimals, update.numeric_decimals);
        Self::set_format_cell_item(pos, &mut self.numeric_commas, update.numeric_commas);
        Self::set_format_cell_item(pos, &mut self.bold, update.bold);
        Self::set_format_cell_item(pos, &mut self.italic, update.italic);
        Self::set_format_cell_item(pos, &mut self.text_color, update.text_color);
        Self::set_format_cell_item(pos, &mut self.fill_color, update.fill_color);
        Self::set_format_cell_item(pos, &mut self.render_size, update.render_size);
        Self::set_format_cell_item(pos, &mut self.date_time, update.date_time);
        Self::set_format_cell_item(pos, &mut self.underline, update.underline);
        Self::set_format_cell_item(pos, &mut self.strike_through, update.strike_through);
    }

    fn format_update_item<T>(item: &SheetFormatUpdatesType<T>, pos: Pos) -> Option<Option<T>>
    where
        T: Clone + Debug + PartialEq,
    {
        item.as_ref()
            .and_then(|item| item.get(pos).map(|c| c.into()))
    }

    /// Returns the format for a cell within the SheetFormatUpdates.
    pub fn format_update(&self, pos: Pos) -> FormatUpdate {
        FormatUpdate {
            align: Self::format_update_item(&self.align, pos),
            vertical_align: Self::format_update_item(&self.vertical_align, pos),
            wrap: Self::format_update_item(&self.wrap, pos),
            numeric_format: Self::format_update_item(&self.numeric_format, pos),
            numeric_decimals: Self::format_update_item(&self.numeric_decimals, pos),
            numeric_commas: Self::format_update_item(&self.numeric_commas, pos),
            bold: Self::format_update_item(&self.bold, pos),
            italic: Self::format_update_item(&self.italic, pos),
            text_color: Self::format_update_item(&self.text_color, pos),
            fill_color: Self::format_update_item(&self.fill_color, pos),
            render_size: Self::format_update_item(&self.render_size, pos),
            date_time: Self::format_update_item(&self.date_time, pos),
            underline: Self::format_update_item(&self.underline, pos),
            strike_through: Self::format_update_item(&self.strike_through, pos),
        }
    }

    fn set_format_rect_item<T>(
        item: &mut SheetFormatUpdatesType<T>,
        rect: Rect,
        value: Option<Option<T>>,
    ) where
        T: Clone + Debug + PartialEq,
    {
        value.map(|value| {
            item.get_or_insert_with(Default::default).set_rect(
                rect.min.x,
                rect.min.y,
                Some(rect.max.x),
                Some(rect.max.y),
                Some(value.into()),
            );
        });
    }

    pub fn set_format_rect(&mut self, rect: Rect, update: FormatUpdate) {
        Self::set_format_rect_item(&mut self.align, rect, update.align);
        Self::set_format_rect_item(&mut self.vertical_align, rect, update.vertical_align);
        Self::set_format_rect_item(&mut self.wrap, rect, update.wrap);
        Self::set_format_rect_item(&mut self.numeric_format, rect, update.numeric_format);
        Self::set_format_rect_item(&mut self.numeric_decimals, rect, update.numeric_decimals);
        Self::set_format_rect_item(&mut self.numeric_commas, rect, update.numeric_commas);
        Self::set_format_rect_item(&mut self.bold, rect, update.bold);
        Self::set_format_rect_item(&mut self.italic, rect, update.italic);
        Self::set_format_rect_item(&mut self.text_color, rect, update.text_color);
        Self::set_format_rect_item(&mut self.fill_color, rect, update.fill_color);
        Self::set_format_rect_item(&mut self.render_size, rect, update.render_size);
        Self::set_format_rect_item(&mut self.date_time, rect, update.date_time);
        Self::set_format_rect_item(&mut self.underline, rect, update.underline);
        Self::set_format_rect_item(&mut self.strike_through, rect, update.strike_through);
    }

    fn translate_rect_item<T>(item: &mut SheetFormatUpdatesType<T>, x: i64, y: i64)
    where
        T: Clone + Debug + PartialEq,
    {
        item.get_or_insert_with(Default::default)
            .translate_in_place(x, y);
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        Self::translate_rect_item(&mut self.align, x, y);
        Self::translate_rect_item(&mut self.vertical_align, x, y);
        Self::translate_rect_item(&mut self.wrap, x, y);
        Self::translate_rect_item(&mut self.numeric_format, x, y);
        Self::translate_rect_item(&mut self.numeric_decimals, x, y);
        Self::translate_rect_item(&mut self.numeric_commas, x, y);
        Self::translate_rect_item(&mut self.bold, x, y);
        Self::translate_rect_item(&mut self.italic, x, y);
        Self::translate_rect_item(&mut self.text_color, x, y);
        Self::translate_rect_item(&mut self.fill_color, x, y);
        Self::translate_rect_item(&mut self.render_size, x, y);
        Self::translate_rect_item(&mut self.date_time, x, y);
        Self::translate_rect_item(&mut self.underline, x, y);
        Self::translate_rect_item(&mut self.strike_through, x, y);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_is_default() {
        let mut s = SheetFormatUpdates::default();
        assert!(s.is_default());

        s.align = Contiguous2D::new_from_opt_selection(
            &A1Selection::test_a1("A1:B2"),
            Some(ClearOption::Some(CellAlign::Center)),
        );
        assert!(!s.is_default());
    }

    #[test]
    fn test_set_format_cell() {
        let mut updates = SheetFormatUpdates::default();
        let pos = pos![B3];

        let format_update = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            bold: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            ..Default::default()
        };

        updates.set_format_cell(pos, format_update);

        // Verify the updated fields
        let format = updates.format_update(pos);
        assert_eq!(format.bold, Some(Some(true)));
        assert_eq!(format.align, Some(Some(CellAlign::Center)));
        assert_eq!(format.text_color, Some(Some("red".to_string())));

        // Verify other fields remained None
        assert!(updates.vertical_align.is_none());
        assert!(updates.wrap.is_none());
        assert!(updates.numeric_format.is_none());
    }
}