use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::grid::borders::style::BorderStyle;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
pub(super) enum CellSide {
    Left,
    Top,
    Right,
    Bottom,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default)]
pub(super) struct CellBorders {
    borders: HashMap<CellSide, BorderStyle>, // TODO: Smaller data structure?
}

impl CellBorders {
    #[cfg(test)]
    pub(super) fn new(borders: HashMap<CellSide, BorderStyle>) -> Self {
        Self { borders }
    }

    #[cfg(test)]
    pub(super) fn contains(&self, side: &CellSide) -> bool {
        self.borders.contains_key(side)
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
        self.borders.is_empty()
    }

    pub(super) fn get(&self, side: &CellSide) -> Option<&BorderStyle> {
        self.borders.get(side)
    }

    fn with_side(&self, side: CellSide, style: Option<BorderStyle>) -> Self {
        let mut cloned = self.clone();
        if style.is_some() {
            cloned.borders.insert(side, style.unwrap());
        } else {
            cloned.borders.remove(&side);
        }
        cloned
    }
}
