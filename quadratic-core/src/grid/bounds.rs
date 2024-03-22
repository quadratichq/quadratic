use serde::{Deserialize, Serialize};

use crate::{Pos, Rect};

#[derive(PartialEq)]
pub struct BoundsRect {
    pub x: i64,
    pub y: i64,
    pub width: u32,
    pub height: u32,
}

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

impl From<GridBounds> for Option<Rect> {
    fn from(bounds: GridBounds) -> Self {
        match bounds {
            GridBounds::Empty => None,
            GridBounds::NonEmpty(rect) => Some(rect),
        }
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
    pub fn to_bounds_rect(&self) -> Option<BoundsRect> {
        match self {
            GridBounds::Empty => None,
            GridBounds::NonEmpty(rect) => Some(BoundsRect {
                x: rect.min.x,
                y: rect.min.y,
                width: rect.width(),
                height: rect.height(),
            }),
        }
    }
}
