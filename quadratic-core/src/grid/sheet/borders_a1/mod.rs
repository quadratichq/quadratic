//! A1-style borders.
//!
//! The BorderStyleTimestamp is necessary to differentiate between overlapping
//! left/right and top/bottom borders--eg, if a cell has a right border and its
//! neighbor to the right has a left border, then we need to know which one to
//! display. Right borders do not necessarily override their neighbors left
//! border.

use serde::{Deserialize, Serialize};

use crate::{grid::Contiguous2D, Pos};

pub mod borders_query;
pub mod borders_render;
pub mod borders_set;
mod borders_style;
pub mod sides;

pub use borders_style::*;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BordersA1 {
    pub(crate) left: Contiguous2D<Option<BorderStyleTimestamp>>,
    pub(crate) right: Contiguous2D<Option<BorderStyleTimestamp>>,
    pub(crate) top: Contiguous2D<Option<BorderStyleTimestamp>>,
    pub(crate) bottom: Contiguous2D<Option<BorderStyleTimestamp>>,
}

impl BordersA1 {
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
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BordersA1Updates {
    pub(crate) left: Option<Contiguous2D<Option<Option<BorderStyleTimestamp>>>>,
    pub(crate) right: Option<Contiguous2D<Option<Option<BorderStyleTimestamp>>>>,
    pub(crate) top: Option<Contiguous2D<Option<Option<BorderStyleTimestamp>>>>,
    pub(crate) bottom: Option<Contiguous2D<Option<Option<BorderStyleTimestamp>>>>,
}

impl BordersA1Updates {
    pub fn set_style_cell(&mut self, pos: Pos, style: BorderStyleCell) {
        if let Some(top) = style.top {
            self.top
                .get_or_insert_with(Default::default)
                .set(pos, Some(Some(top)));
        }
        if let Some(bottom) = style.bottom {
            self.bottom
                .get_or_insert_with(Default::default)
                .set(pos, Some(Some(bottom)));
        }
        if let Some(left) = style.left {
            self.left
                .get_or_insert_with(Default::default)
                .set(pos, Some(Some(left)));
        }
        if let Some(right) = style.right {
            self.right
                .get_or_insert_with(Default::default)
                .set(pos, Some(Some(right)));
        }
    }

    pub fn is_default(&self) -> bool {
        self.left.is_none() && self.right.is_none() && self.top.is_none() && self.bottom.is_none()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn is_default() {
        let updates = BordersA1Updates::default();
        assert!(updates.is_default());

        let updates = BordersA1Updates {
            left: Some(Contiguous2D::default()),
            ..Default::default()
        };
        assert!(!updates.is_default());
    }
}
