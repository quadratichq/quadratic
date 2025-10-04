use crate::{Pos, Rect};
use serde::{Deserialize, Serialize};

/// TODO: consider consolidating this with [`Rect`].
///       if it should stay distinct, document why!
#[derive(Debug, PartialEq)]
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
    pub(crate) fn is_empty(&self) -> bool {
        *self == GridBounds::Empty
    }
    pub(crate) fn clear(&mut self) {
        *self = GridBounds::default();
    }
    pub(crate) fn add(&mut self, pos: Pos) {
        match self {
            GridBounds::Empty => *self = Rect::single_pos(pos).into(),
            GridBounds::NonEmpty(rect) => rect.extend_to(pos),
        }
    }
    pub(crate) fn add_rect(&mut self, rect: Rect) {
        match self {
            GridBounds::Empty => *self = rect.into(),
            GridBounds::NonEmpty(r) => *r = r.union(&rect),
        }
    }
    pub(crate) fn merge(a: Self, b: Self) -> Self {
        match (a, b) {
            (GridBounds::Empty, r) | (r, GridBounds::Empty) => r,
            (GridBounds::NonEmpty(mut a), GridBounds::NonEmpty(b)) => {
                a.extend_to(b.min);
                a.extend_to(b.max);
                GridBounds::NonEmpty(a)
            }
        }
    }
    pub(crate) fn as_bounds_rect(&self) -> Option<BoundsRect> {
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

    pub(crate) fn first_column(&self) -> Option<i64> {
        self.as_bounds_rect().map(|rect| rect.x)
    }

    pub(crate) fn last_column(&self) -> Option<i64> {
        self.as_bounds_rect()
            .map(|rect| rect.x + rect.width as i64 - 1)
    }

    pub(crate) fn first_row(&self) -> Option<i64> {
        self.as_bounds_rect().map(|rect| rect.y)
    }

    pub(crate) fn last_row(&self) -> Option<i64> {
        self.as_bounds_rect()
            .map(|rect| rect.y + rect.height as i64 - 1)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_bounds_rect() {
        let bounds = BoundsRect {
            x: 1,
            y: 2,
            width: 3,
            height: 4,
        };
        let grid_bounds = GridBounds::NonEmpty(Rect::new(1, 2, 3, 5));
        assert_eq!(grid_bounds.as_bounds_rect(), Some(bounds));
    }

    #[test]
    fn test_bounds_rect_empty() {
        let grid_bounds = GridBounds::Empty;
        assert_eq!(grid_bounds.as_bounds_rect(), None);
    }

    #[test]
    fn test_first_column() {
        let grid_bounds = GridBounds::NonEmpty(Rect::new(1, 2, 3, 4));
        assert_eq!(grid_bounds.first_column(), Some(1));

        let empty_bounds = GridBounds::Empty;
        assert_eq!(empty_bounds.first_column(), None);
    }

    #[test]
    fn test_last_column() {
        let grid_bounds = GridBounds::NonEmpty(Rect::new(1, 2, 3, 4));
        assert_eq!(grid_bounds.last_column(), Some(3));

        let empty_bounds = GridBounds::Empty;
        assert_eq!(empty_bounds.last_column(), None);
    }

    #[test]
    fn test_first_row() {
        let grid_bounds = GridBounds::NonEmpty(Rect::new(1, 2, 3, 4));
        assert_eq!(grid_bounds.first_row(), Some(2));

        let empty_bounds = GridBounds::Empty;
        assert_eq!(empty_bounds.first_row(), None);
    }

    #[test]
    fn test_last_row() {
        let grid_bounds = GridBounds::NonEmpty(Rect::new(1, 2, 3, 4));
        assert_eq!(grid_bounds.last_row(), Some(4));

        let empty_bounds = GridBounds::Empty;
        assert_eq!(empty_bounds.last_row(), None);
    }
}
