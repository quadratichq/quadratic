//! Handles the logic for removing cells from a selection.

use crate::{Pos, Rect};

use super::A1Selection;

impl A1Selection {
    pub fn exclude_cells(&mut self, p1: Pos, p2: Option<Pos>) {
        self.ranges.retain_mut(|range| {
            // remove the entire range if it is only start-Option<end>
            if range.is_pos_range(p1, p2) {
                false
            } else {
                if let Some(p2) = p2 {
                    if range.might_intersect_rect(Rect { min: p1, max: p2 }) {
                        // do something
                    }
                } else if range.might_contain_pos(p1) {
                    // do something
                }
                true
            }
        });
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use crate::CellRefRange;

    use super::*;

    #[test]
    fn test_exclude_cells() {
        let mut selection = A1Selection::test("A1,B2:C3");
        selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }));
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1")]);

        selection = A1Selection::test("B2:C3");
        selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }));
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 });

        selection = A1Selection::test("A1:C3");
        selection.exclude_cells("B2".into(), None);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A1"), CellRefRange::test("C3")]
        );
    }
}
