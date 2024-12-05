//! A1-style borders.
//!
//! The BorderStyleTimestamp is necessary to differentiate between overlapping
//! left/right and top/bottom borders--eg, if a cell has a right border and its
//! neighbor to the right has a left border, then we need to know which one to
//! display. Right borders do not necessarily override their neighbors left
//! border.

use serde::{Deserialize, Serialize};

use crate::grid::Contiguous2D;

pub mod borders_query;
pub mod borders_render;
pub mod borders_set_a1;
mod borders_style;
pub mod borders_toggle;
pub mod borders_update;
pub mod sides;

pub use borders_style::*;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BordersA1 {
    pub(crate) left: Contiguous2D<BorderStyleTimestamp>,
    pub(crate) right: Contiguous2D<BorderStyleTimestamp>,
    pub(crate) top: Contiguous2D<BorderStyleTimestamp>,
    pub(crate) bottom: Contiguous2D<BorderStyleTimestamp>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BordersA1Updates {
    pub(crate) left: Option<Contiguous2D<Option<BorderStyleTimestamp>>>,
    pub(crate) right: Option<Contiguous2D<Option<BorderStyleTimestamp>>>,
    pub(crate) top: Option<Contiguous2D<Option<BorderStyleTimestamp>>>,
    pub(crate) bottom: Option<Contiguous2D<Option<BorderStyleTimestamp>>>,
}

impl BordersA1Updates {
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
