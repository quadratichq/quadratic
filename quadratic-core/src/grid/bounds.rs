use serde::{Deserialize, Serialize};

use crate::{Pos, Rect};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(tag = "type", rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum GridBounds {
    Empty,
    NonEmpty(Rect),
}
impl Default for GridBounds {
    fn default() -> Self {
        Self::Empty
    }
}
impl From<Rect> for GridBounds {
    fn from(rect: Rect) -> Self {
        GridBounds::NonEmpty(rect)
    }
}
impl GridBounds {
    pub fn is_empty(&self) -> bool {
        *self == GridBounds::Empty
    }
    pub fn clear(&mut self) {
        *self = GridBounds::default();
    }
    pub fn add(&mut self, pos: Pos) {
        match self {
            GridBounds::Empty => *self = Rect::single_pos(pos).into(),
            GridBounds::NonEmpty(rect) => rect.extend_to(pos),
        }
    }
    pub fn merge(a: Self, b: Self) -> Self {
        match (a, b) {
            (GridBounds::Empty, r) | (r, GridBounds::Empty) => r,
            (GridBounds::NonEmpty(mut a), GridBounds::NonEmpty(b)) => {
                a.extend_to(b.min);
                a.extend_to(b.max);
                GridBounds::NonEmpty(a)
            }
        }
    }
}
