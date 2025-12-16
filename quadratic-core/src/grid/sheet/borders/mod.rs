//! A1-style borders.
//!
//! The BorderStyleTimestamp is necessary to differentiate between overlapping
//! left/right and top/bottom borders--eg, if a cell has a right border and its
//! neighbor to the right has a left border, then we need to know which one to
//! display. Right borders do not necessarily override their neighbors left
//! border.

use serde::{Deserialize, Serialize};

use crate::{ClearOption, Pos, Rect, grid::Contiguous2D};

mod borders_clipboard;
mod borders_col_row;
mod borders_merged_cells;
pub mod borders_old;
mod borders_query;
mod borders_render;
mod borders_set;
pub mod borders_style;
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

    #[cfg(test)]
    /// Used to compare borders for testing, ignoring the timestamp.
    pub fn compare_borders(borders: &Borders, other: &Borders) -> bool {
        let left_1: Contiguous2D<Option<BorderStyle>> =
            borders.left.map_ref(|left| left.map(|left| left.into()));
        let left_2: Contiguous2D<Option<BorderStyle>> =
            other.left.map_ref(|left| left.map(|left| left.into()));
        if left_1 != left_2 {
            return false;
        }
        let right_1: Contiguous2D<Option<BorderStyle>> = borders
            .right
            .map_ref(|right| right.map(|right| right.into()));
        let right_2: Contiguous2D<Option<BorderStyle>> =
            other.right.map_ref(|right| right.map(|right| right.into()));
        if right_1 != right_2 {
            return false;
        }
        let top_1: Contiguous2D<Option<BorderStyle>> =
            borders.top.map_ref(|top| top.map(|top| top.into()));
        let top_2: Contiguous2D<Option<BorderStyle>> =
            other.top.map_ref(|top| top.map(|top| top.into()));
        if top_1 != top_2 {
            return false;
        }
        let bottom_1: Contiguous2D<Option<BorderStyle>> = borders
            .bottom
            .map_ref(|bottom| bottom.map(|bottom| bottom.into()));
        let bottom_2: Contiguous2D<Option<BorderStyle>> = other
            .bottom
            .map_ref(|bottom| bottom.map(|bottom| bottom.into()));
        if bottom_1 != bottom_2 {
            return false;
        }
        true
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

    pub fn merge(&mut self, other: &BordersUpdates) {
        if let Some(left) = other.left.as_ref() {
            self.left
                .get_or_insert_with(Default::default)
                .update_from(left, |value, new_value| value.replace(*new_value));
        }
        if let Some(right) = other.right.as_ref() {
            self.right
                .get_or_insert_with(Default::default)
                .update_from(right, |value, new_value| value.replace(*new_value));
        }
        if let Some(top) = other.top.as_ref() {
            self.top
                .get_or_insert_with(Default::default)
                .update_from(top, |value, new_value| value.replace(*new_value));
        }
        if let Some(bottom) = other.bottom.as_ref() {
            self.bottom
                .get_or_insert_with(Default::default)
                .update_from(bottom, |value, new_value| value.replace(*new_value));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::a1::A1Selection;

    #[test]
    fn test_is_empty() {
        let updates = BordersUpdates::default();
        assert!(updates.is_empty());

        let updates = BordersUpdates {
            left: Contiguous2D::new_from_opt_selection(
                &A1Selection::test_a1("A1"),
                Some(ClearOption::Some(BorderStyleTimestamp::default())),
            ),
            ..Default::default()
        };
        assert!(!updates.is_empty());
    }
}
