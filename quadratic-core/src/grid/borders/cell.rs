use serde::{Deserialize, Serialize};

use crate::grid::borders::style::BorderStyle;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
#[repr(u8)]
pub enum CellSide {
    Left = 0,
    Top = 1,
    Right = 2,
    Bottom = 3,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default, Copy)]
pub struct CellBorders {
    pub borders: [Option<BorderStyle>; 4],
}

impl CellBorders {
    pub fn new(borders: &[(CellSide, BorderStyle)]) -> Self {
        let mut as_array = [None; 4];
        for (side, style) in borders {
            as_array[*side as usize] = Some(*style);
        }
        Self { borders: as_array }
    }

    #[cfg(test)]
    pub(super) fn contains(&self, side: &CellSide) -> bool {
        self.borders[*side as usize].is_some()
    }

    pub(super) fn combine(
        maybe_existing: Option<Self>,
        side: CellSide,
        style: Option<BorderStyle>,
    ) -> Self {
        if let Some(existing) = maybe_existing {
            existing.with_side(side, style)
        } else {
            Self::default().with_side(side, style)
        }
    }

    pub(super) fn is_empty(&self) -> bool {
        self.borders.iter().all(|style| style.is_none())
    }

    fn with_side(&self, side: CellSide, style: Option<BorderStyle>) -> Self {
        let mut cloned = *self;
        cloned.borders[side as usize] = style;
        cloned
    }
}
