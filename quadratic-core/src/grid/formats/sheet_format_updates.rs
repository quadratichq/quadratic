//! Used to store formatting changes to apply to an entire sheet.

use serde::{Deserialize, Serialize};

use crate::{
    grid::{CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat, RenderSize},
    A1Selection, Pos, Rect,
};

use super::FormatUpdate;

#[derive(Deserialize, Serialize, Default, Debug, Clone, Eq, PartialEq)]
pub struct SheetFormatUpdates {
    pub align: Option<Contiguous2D<Option<Option<CellAlign>>>>,
    pub vertical_align: Option<Contiguous2D<Option<Option<CellVerticalAlign>>>>,
    pub wrap: Option<Contiguous2D<Option<Option<CellWrap>>>>,
    pub numeric_format: Option<Contiguous2D<Option<Option<NumericFormat>>>>,
    pub numeric_decimals: Option<Contiguous2D<Option<Option<i16>>>>,
    pub numeric_commas: Option<Contiguous2D<Option<Option<bool>>>>,
    pub bold: Option<Contiguous2D<Option<Option<bool>>>>,
    pub italic: Option<Contiguous2D<Option<Option<bool>>>>,
    pub text_color: Option<Contiguous2D<Option<Option<String>>>>,
    pub fill_color: Option<Contiguous2D<Option<Option<String>>>>,
    pub render_size: Option<Contiguous2D<Option<Option<RenderSize>>>>,
    pub date_time: Option<Contiguous2D<Option<Option<String>>>>,
    pub underline: Option<Contiguous2D<Option<Option<bool>>>>,
    pub strike_through: Option<Contiguous2D<Option<Option<bool>>>>,
}
impl SheetFormatUpdates {
    /// Constructs a format update that applies the same formatting to every
    /// affected cell.
    pub fn from_selection(selection: &A1Selection, update: FormatUpdate) -> Self {
        Self {
            align: Contiguous2D::new_from_opt_selection(selection, update.align),
            vertical_align: Contiguous2D::new_from_opt_selection(selection, update.vertical_align),
            wrap: Contiguous2D::new_from_opt_selection(selection, update.wrap),
            numeric_format: Contiguous2D::new_from_opt_selection(
                selection,
                update.numeric_format.clone(),
            ),
            numeric_decimals: Contiguous2D::new_from_opt_selection(
                selection,
                update.numeric_decimals,
            ),
            numeric_commas: Contiguous2D::new_from_opt_selection(selection, update.numeric_commas),
            bold: Contiguous2D::new_from_opt_selection(selection, update.bold),
            italic: Contiguous2D::new_from_opt_selection(selection, update.italic),
            text_color: Contiguous2D::new_from_opt_selection(selection, update.text_color.clone()),
            fill_color: Contiguous2D::new_from_opt_selection(selection, update.fill_color.clone()),
            render_size: Contiguous2D::new_from_opt_selection(
                selection,
                update.render_size.clone(),
            ),
            date_time: Contiguous2D::new_from_opt_selection(selection, update.date_time.clone()),
            underline: Contiguous2D::new_from_opt_selection(selection, update.underline),
            strike_through: Contiguous2D::new_from_opt_selection(selection, update.strike_through),
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

    pub fn set_format_cell(&mut self, pos: Pos, update: FormatUpdate) {
        update.align.map(|align| {
            self.align
                .get_or_insert_with(Default::default)
                .set(pos, Some(align))
        });
        update.vertical_align.map(|vertical_align| {
            self.vertical_align
                .get_or_insert_with(Default::default)
                .set(pos, Some(vertical_align))
        });
        update.wrap.map(|wrap| {
            self.wrap
                .get_or_insert_with(Default::default)
                .set(pos, Some(wrap))
        });
        update.numeric_format.map(|numeric_format| {
            self.numeric_format
                .get_or_insert_with(Default::default)
                .set(pos, Some(numeric_format))
        });
        update.numeric_decimals.map(|numeric_decimals| {
            self.numeric_decimals
                .get_or_insert_with(Default::default)
                .set(pos, Some(numeric_decimals))
        });
        update.numeric_commas.map(|numeric_commas| {
            self.numeric_commas
                .get_or_insert_with(Default::default)
                .set(pos, Some(numeric_commas))
        });
        update.bold.map(|bold| {
            self.bold
                .get_or_insert_with(Default::default)
                .set(pos, Some(bold))
        });
        update.italic.map(|italic| {
            self.italic
                .get_or_insert_with(Default::default)
                .set(pos, Some(italic))
        });
        update.text_color.map(|text_color| {
            self.text_color
                .get_or_insert_with(Default::default)
                .set(pos, Some(text_color))
        });
        update.fill_color.map(|fill_color| {
            self.fill_color
                .get_or_insert_with(Default::default)
                .set(pos, Some(fill_color))
        });
        update.render_size.map(|render_size| {
            self.render_size
                .get_or_insert_with(Default::default)
                .set(pos, Some(render_size))
        });
        update.date_time.map(|date_time| {
            self.date_time
                .get_or_insert_with(Default::default)
                .set(pos, Some(date_time))
        });
        update.underline.map(|underline| {
            self.underline
                .get_or_insert_with(Default::default)
                .set(pos, Some(underline))
        });
        update.strike_through.map(|strike_through| {
            self.strike_through
                .get_or_insert_with(Default::default)
                .set(pos, Some(strike_through))
        });
    }

    /// Returns the format for a cell within the SheetFormatUpdates.
    pub fn format_update(&self, pos: Pos) -> FormatUpdate {
        FormatUpdate {
            align: self.align.as_ref().and_then(|align| align.get(pos)),
            vertical_align: self
                .vertical_align
                .as_ref()
                .and_then(|vertical_align| vertical_align.get(pos)),
            wrap: self.wrap.as_ref().and_then(|wrap| wrap.get(pos)),
            numeric_format: self
                .numeric_format
                .as_ref()
                .and_then(|numeric_format| numeric_format.get(pos))
                .clone(),
            numeric_decimals: self
                .numeric_decimals
                .as_ref()
                .and_then(|numeric_decimals| numeric_decimals.get(pos)),
            numeric_commas: self
                .numeric_commas
                .as_ref()
                .and_then(|numeric_commas| numeric_commas.get(pos)),
            bold: self.bold.as_ref().and_then(|bold| bold.get(pos)),
            italic: self.italic.as_ref().and_then(|italic| italic.get(pos)),
            text_color: self
                .text_color
                .as_ref()
                .and_then(|text_color| text_color.get(pos))
                .clone(),
            fill_color: self
                .fill_color
                .as_ref()
                .and_then(|fill_color| fill_color.get(pos))
                .clone(),
            render_size: self
                .render_size
                .as_ref()
                .and_then(|render_size| render_size.get(pos))
                .clone(),
            date_time: self
                .date_time
                .as_ref()
                .and_then(|date_time| date_time.get(pos))
                .clone(),
            underline: self
                .underline
                .as_ref()
                .and_then(|underline| underline.get(pos)),
            strike_through: self
                .strike_through
                .as_ref()
                .and_then(|strike_through| strike_through.get(pos)),
        }
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
            Some(Some(CellAlign::Center)),
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
