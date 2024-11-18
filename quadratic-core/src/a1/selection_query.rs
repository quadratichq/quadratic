use std::collections::HashSet;

use crate::{Pos, Rect};

use super::A1Selection;

impl A1Selection {
    /// Returns whether the selection contains the given position.
    pub fn contains(&self, x: u64, y: u64) -> bool {
        self.ranges
            .iter()
            .any(|range| range.might_contain_pos(Pos::new(x as i64, y as i64)))
    }

    /// Returns whether any range in `self` might contain `pos`.
    pub fn contains_pos(&self, pos: Pos) -> bool {
        self.ranges.iter().any(|range| range.might_contain_pos(pos))
    }

    /// Returns whether any range in `self` might contain `pos`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_contain_pos(&self, pos: Pos) -> bool {
        self.ranges.iter().any(|range| range.might_contain_pos(pos))
    }

    /// Returns the largest rectangle that can be formed by the selection,
    /// ignoring any ranges that extend infinitely.
    pub fn largest_rect_finite(&self) -> Rect {
        let mut rect = Rect::single_pos(self.cursor);
        self.ranges.iter().for_each(|range| {
            if let Some(end) = range.end {
                let (Some(end_col), Some(end_row)) = (end.col, end.row) else {
                    return;
                };
                let (Some(start_col), Some(start_row)) = (range.start.col, range.start.row) else {
                    return;
                };
                rect = rect.union(&Rect::new(
                    start_col.coord as i64,
                    start_row.coord as i64,
                    end_col.coord as i64,
                    end_row.coord as i64,
                ));
            }
        });
        rect
    }

    /// Returns the largest rectangle that can be formed by the selection.
    pub fn largest_rect(&self) -> Rect {
        let mut rect = Rect::single_pos(self.cursor);
        self.ranges.iter().for_each(|range| {
            if let Some(col) = range.start.col {
                rect.min.x = rect.min.x.min(col.coord as i64);
                rect.max.x = rect.max.x.max(col.coord as i64);
            }
            if let Some(row) = range.start.row {
                rect.min.y = rect.min.y.min(row.coord as i64);
                rect.max.y = rect.max.y.max(row.coord as i64);
            }
            if let Some(end) = range.end {
                if let Some(end_col) = end.col {
                    rect.min.x = rect.min.x.min(end_col.coord as i64);
                    rect.max.x = rect.max.x.max(end_col.coord as i64);
                }
                if let Some(end_row) = end.row {
                    rect.min.y = rect.min.y.min(end_row.coord as i64);
                    rect.max.y = rect.max.y.max(end_row.coord as i64);
                }
            }
        });

        rect
    }

    // Converts to a set of quadrant positions.
    pub fn rects_to_hashes(&self) -> HashSet<Pos> {
        let mut hashes = HashSet::new();
        self.ranges.iter().for_each(|range| {
            if let Some(rect) = range.to_rect() {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        let mut pos = Pos { x, y };
                        pos.to_quadrant();
                        hashes.insert(pos);
                    }
                }
            }
        });
        hashes
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use std::collections::HashMap;

    use crate::grid::SheetId;

    use super::*;

    #[test]
    fn test_contains() {
        let selection =
            A1Selection::from_str("A1,B2,C3", SheetId::test(), &HashMap::new()).unwrap();
        assert!(selection.contains(1, 1));
        assert!(!selection.contains(4, 1));
    }

    #[test]
    fn test_contains_pos() {
        let selection =
            A1Selection::from_str("A1,B2,C3", SheetId::test(), &HashMap::new()).unwrap();
        assert!(selection.contains_pos(pos![A1]));
        assert!(!selection.contains_pos(pos![D1]));
    }

    #[test]
    fn test_might_contain_pos() {
        let selection =
            A1Selection::from_str("A1,B2,C3", SheetId::test(), &HashMap::new()).unwrap();
        assert!(selection.might_contain_pos(pos![A1]));
        assert!(!selection.might_contain_pos(pos![D1]));
    }

    #[test]
    fn test_largest_rect() {
        let selection = A1Selection::from_str(
            "A1,B1:D2,E:G,2:3,5:7,F6:G8,4",
            SheetId::test(),
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(selection.largest_rect(), Rect::new(1, 1, 7, 8));
    }

    #[test]
    fn test_largest_rect_finite() {
        let selection = A1Selection::from_str(
            "A1,B1:D2,E:G,2:3,5:7,F6:G8,4",
            SheetId::test(),
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(selection.largest_rect_finite(), Rect::new(1, 1, 7, 8));
    }
}
