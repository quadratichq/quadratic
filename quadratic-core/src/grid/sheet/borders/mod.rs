//! A1-style borders.
//!
//! The BorderStyleTimestamp is necessary to differentiate between overlapping
//! left/right and top/bottom borders--eg, if a cell has a right border and its
//! neighbor to the right has a left border, then we need to know which one to
//! display. Right borders do not necessarily override their neighbors left
//! border.

use serde::{Deserialize, Serialize};

use crate::{grid::Contiguous2D, ClearOption, Pos, Rect};

pub mod borders_clipboard;
pub mod borders_col_row;
pub mod borders_old;
pub mod borders_query;
pub mod borders_render;
pub mod borders_set;
mod borders_style;
mod borders_test;
pub mod sides;

pub use borders_style::*;

pub type BordersType = Contiguous2D<Option<BorderStyleTimestamp>>;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Borders {
    pub(crate) left: BordersType,
    pub(crate) right: BordersType,
    pub(crate) top: BordersType,
    pub(crate) bottom: BordersType,
}

impl Borders {
    /// Returns the border style for the given position.
    pub fn get_style_cell(&self, pos: Pos) -> BorderStyleCell {
        BorderStyleCell {
            left: self.left.get(pos),
            right: self.right.get(pos),
            top: self.top.get(pos),
            bottom: self.bottom.get(pos),
        }
    }

    /// Overrides the border style of the cell with the new border style or
    /// clears the border if the new border style is None. If force_clear is
    /// true, then the border is set to BorderLineStyle::Clear, otherwise the
    /// border is set to Some(None) (ie, removed).
    pub fn get_style_cell_override_border(&self, pos: Pos, force_clear: bool) -> BorderStyleCell {
        let clear = if force_clear {
            Some(BorderStyleTimestamp::clear())
        } else {
            None
        };
        BorderStyleCell {
            top: self.top.get(pos).map(Some).unwrap_or(clear),
            bottom: self.bottom.get(pos).map(Some).unwrap_or(clear),
            left: self.left.get(pos).map(Some).unwrap_or(clear),
            right: self.right.get(pos).map(Some).unwrap_or(clear),
        }
    }

    /// Returns the border style for the given side and position.
    pub fn get_side(&self, side: BorderSide, pos: Pos) -> Option<BorderStyle> {
        match side {
            BorderSide::Top => self.top.get(pos).map(|b| b.into()),
            BorderSide::Bottom => self.bottom.get(pos).map(|b| b.into()),
            BorderSide::Left => self.left.get(pos).map(|b| b.into()),
            BorderSide::Right => self.right.get(pos).map(|b| b.into()),
        }
    }

    pub fn set_style_cell(&mut self, pos: Pos, style: BorderStyleCell) {
        self.top.set(pos, style.top);
        self.bottom.set(pos, style.bottom);
        self.left.set(pos, style.left);
        self.right.set(pos, style.right);
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.left.translate_in_place(x, y);
        self.right.translate_in_place(x, y);
        self.top.translate_in_place(x, y);
        self.bottom.translate_in_place(x, y);
    }
}

pub type BordersUpdatesType = Option<Contiguous2D<Option<ClearOption<BorderStyleTimestamp>>>>;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BordersUpdates {
    pub(crate) left: BordersUpdatesType,
    pub(crate) right: BordersUpdatesType,
    pub(crate) top: BordersUpdatesType,
    pub(crate) bottom: BordersUpdatesType,
}

impl BordersUpdates {
    pub fn set_style_cell(&mut self, pos: Pos, style: BorderStyleCell) {
        if let Some(top) = style.top {
            self.top
                .get_or_insert_with(Default::default)
                .set(pos, Some(ClearOption::Some(top)));
        }
        if let Some(bottom) = style.bottom {
            self.bottom
                .get_or_insert_with(Default::default)
                .set(pos, Some(ClearOption::Some(bottom)));
        }
        if let Some(left) = style.left {
            self.left
                .get_or_insert_with(Default::default)
                .set(pos, Some(ClearOption::Some(left)));
        }
        if let Some(right) = style.right {
            self.right
                .get_or_insert_with(Default::default)
                .set(pos, Some(ClearOption::Some(right)));
        }
    }

    /// Returns true if there are no updates.
    pub fn is_empty(&self) -> bool {
        self.left.as_ref().is_none_or(|c| c.is_all_default())
            && self.right.as_ref().is_none_or(|c| c.is_all_default())
            && self.top.as_ref().is_none_or(|c| c.is_all_default())
            && self.bottom.as_ref().is_none_or(|c| c.is_all_default())
    }

    pub fn intersects(&self, rect: Rect) -> bool {
        self.left.as_ref().is_some_and(|left| left.intersects(rect))
            || self
                .right
                .as_ref()
                .is_some_and(|right| right.intersects(rect))
            || self.top.as_ref().is_some_and(|top| top.intersects(rect))
            || self
                .bottom
                .as_ref()
                .is_some_and(|bottom| bottom.intersects(rect))
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        if let Some(left) = self.left.as_mut() {
            left.translate_in_place(x, y);
        }
        if let Some(right) = self.right.as_mut() {
            right.translate_in_place(x, y);
        }
        if let Some(top) = self.top.as_mut() {
            top.translate_in_place(x, y);
        }
        if let Some(bottom) = self.bottom.as_mut() {
            bottom.translate_in_place(x, y);
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    use crate::A1Selection;

    #[test]
    fn test_is_empty() {
        let updates = BordersUpdates::default();
        assert!(updates.is_empty());

        let updates = BordersUpdates {
            left: Contiguous2D::new_from_opt_selection(
                &&A1Selection::test_a1("A1"),
                Some(ClearOption::Some(BorderStyleTimestamp::default())),
            ),
            ..Default::default()
        };
        assert!(!updates.is_empty());
    }
}
