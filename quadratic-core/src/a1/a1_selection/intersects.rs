use crate::{
    Rect,
    a1::{A1Context, RefRangeBounds, TableRef},
};

use super::*;

impl A1Selection {
    /// Returns `true` if any range in this selection intersects with the given rect.
    pub fn intersects_rect(&self, rect: Rect, a1_context: &A1Context) -> bool {
        self.ranges.iter().any(|range| match range {
            CellRefRange::Sheet { range } => {
                let range_rect = range.to_rect_unbounded();
                range_rect.intersects(rect)
            }
            CellRefRange::Table { range } => {
                if let Some(table_rect) = range.to_largest_rect(a1_context) {
                    table_rect.intersects(rect)
                } else {
                    false
                }
            }
        })
    }

    /// Finds intersection of two Selections.
    pub fn intersection(&self, other: &Self, a1_context: &A1Context) -> Option<Self> {
        if self.sheet_id != other.sheet_id {
            return None;
        }
        let mut ranges = vec![];
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                other
                    .ranges
                    .iter()
                    .for_each(|other_range| match other_range {
                        CellRefRange::Sheet { range: other_range } => {
                            let intersection = range.intersection(other_range);
                            if let Some(intersection) = intersection {
                                ranges.push(CellRefRange::Sheet {
                                    range: intersection,
                                });
                            }
                        }
                        CellRefRange::Table { range: other_range } => {
                            if let Some(rect) = other_range.to_largest_rect(a1_context)
                                && let Some(intersection) =
                                    RefRangeBounds::new_relative_rect(rect).intersection(range)
                            {
                                ranges.push(CellRefRange::Sheet {
                                    range: intersection,
                                });
                            }
                        }
                    });
            }
            CellRefRange::Table { range } => {
                if let Some(range) =
                    range.convert_to_ref_range_bounds(false, a1_context, false, false)
                {
                    other
                        .ranges
                        .iter()
                        .for_each(|other_range| match other_range {
                            CellRefRange::Sheet { range: other_range } => {
                                if let Some(intersection) = range.intersection(other_range) {
                                    ranges.push(CellRefRange::Sheet {
                                        range: intersection,
                                    });
                                }
                            }
                            // two tables cannot overlap
                            CellRefRange::Table { .. } => (),
                        });
                }
            }
        });
        if ranges.is_empty() {
            None
        } else {
            let mut result = Self {
                sheet_id: self.sheet_id,
                cursor: self.cursor,
                ranges,
            };

            // try to find a better cursor position
            result.cursor = if result.contains_pos(self.cursor, a1_context) {
                self.cursor
            } else if result.contains_pos(other.cursor, a1_context) {
                other.cursor
            } else {
                let pos = result.last_selection_end(a1_context);
                if result.contains_pos(pos, a1_context) {
                    pos
                } else {
                    let pos = result.last_selection_end(a1_context);
                    if result.contains_pos(pos, a1_context) {
                        pos
                    } else {
                        // give up and just use the cursor even though it's wrong
                        self.cursor
                    }
                }
            };
            Some(result)
        }
    }

    /// Returns `true` if the RefRangeBounds overlaps the TableRef.
    fn overlap_ref_range_bounds_table_ref(
        range: &RefRangeBounds,
        other_range: &TableRef,
        a1_context: &A1Context,
    ) -> bool {
        let rect = range.to_rect_unbounded();
        if let Some(other_rect) = other_range.to_largest_rect(a1_context) {
            rect.intersects(other_rect)
        } else {
            false
        }
    }

    /// Returns `true` if the two selections overlap.
    pub fn overlaps_a1_selection(&self, other: &Self, a1_context: &A1Context) -> bool {
        if self.sheet_id != other.sheet_id {
            return false;
        }

        self.ranges.iter().any(|range| match range {
            CellRefRange::Sheet { range } => {
                other.ranges.iter().any(|other_range| match other_range {
                    CellRefRange::Sheet { range: other_range } => {
                        range.intersection(other_range).is_some()
                    }
                    CellRefRange::Table { range: other_range } => {
                        A1Selection::overlap_ref_range_bounds_table_ref(
                            range,
                            other_range,
                            a1_context,
                        )
                    }
                })
            }
            CellRefRange::Table { range } => {
                other.ranges.iter().any(|other_range| match other_range {
                    CellRefRange::Sheet { range: other_range } => {
                        A1Selection::overlap_ref_range_bounds_table_ref(
                            other_range,
                            range,
                            a1_context,
                        )
                    }
                    CellRefRange::Table { range: other_range } => {
                        let rect = range.to_largest_rect(a1_context);
                        let other = other_range.to_largest_rect(a1_context);
                        if let (Some(rect), Some(other)) = (rect, other) {
                            rect.intersects(other)
                        } else {
                            false
                        }
                    }
                })
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_intersection() {
        let context = A1Context::default();
        // Test different sheets return None
        let sel1 = A1Selection::test_a1_sheet_id("A1:B2", SheetId::new());
        let sel2 = A1Selection::test_a1_sheet_id("B2:C3", SheetId::new());
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Different sheets should return None"
        );

        // Test non-overlapping rectangles return None
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("C3:D4");
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Non-overlapping rectangles should return None"
        );

        // Test overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:C3");
        let sel2 = A1Selection::test_a1("B2:D4");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C3",
            "Overlapping rectangles intersection failed"
        );
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().cursor,
            pos![B2],
            "Cursor position incorrect for overlapping rectangles"
        );

        // Test one rectangle inside another
        let sel1 = A1Selection::test_a1("A1:D4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C3",
            "Rectangle inside another intersection failed"
        );

        // Test overlapping columns
        let sel1 = A1Selection::test_a1("A:C");
        let sel2 = A1Selection::test_a1("B:D");
        let intersection = sel1.intersection(&sel2, &context).unwrap();
        assert_eq!(
            intersection.test_to_string(),
            "B:C",
            "Overlapping columns intersection failed"
        );

        // Test non-overlapping columns return None
        let sel1 = A1Selection::test_a1("A:B");
        let sel2 = A1Selection::test_a1("C:D");
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Non-overlapping columns should return None"
        );

        // Test overlapping rows
        let sel1 = A1Selection::test_a1("1:3");
        let sel2 = A1Selection::test_a1("2:4");
        let intersection = sel1.intersection(&sel2, &context).unwrap();
        assert_eq!(
            intersection.test_to_string(),
            "2:3",
            "Overlapping rows intersection failed"
        );

        // Test non-overlapping rows return None
        let sel1 = A1Selection::test_a1("1:2");
        let sel2 = A1Selection::test_a1("3:4");
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Non-overlapping rows should return None"
        );

        // Test all (*) intersect with all (*)
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("*");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "*",
            "All (*) intersection with all (*) failed"
        );

        // Test single cell intersection
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("B2");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2",
            "Single cell intersection failed"
        );

        // Test multiple disjoint intersections
        let sel1 = A1Selection::test_a1("A1:C3,E1:G3");
        let sel2 = A1Selection::test_a1("B2:F2");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C2,E2:F2",
            "Multiple disjoint intersections failed"
        );

        // Test all (*) intersect with rectangle
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C3",
            "All (*) intersection with rectangle failed"
        );

        // todo(ayush): make this work

        // Test complex intersection with multiple ranges
        // let sel1 = A1Selection::test_a1("A1:C3,E:G,2:4");
        // let sel2 = A1Selection::test_a1("B2:D4,F:H,3:5");
        // assert_eq!(
        //     sel1.intersection(&sel2).unwrap().test_to_string(),
        //     "B2:C3,F:G,3:4",
        //     "Complex intersection with multiple ranges failed"
        // );
    }

    #[test]
    fn test_overlaps_a1_selection() {
        let context = A1Context::test(&[], &[]);
        // Different sheets don't overlap
        let sel1 = A1Selection::test_a1_sheet_id("A1:B2", SheetId::new());
        let sel2 = A1Selection::test_a1_sheet_id("B2:C3", SheetId::new());
        assert!(
            !sel1.overlaps_a1_selection(&sel2, &context),
            "Different sheets should not overlap"
        );

        // Non-overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("C3:D4");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, &context),
            "Non-overlapping rectangles should not overlap"
        );

        // Overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:C3");
        let sel2 = A1Selection::test_a1("B2:D4");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Overlapping rectangles should overlap"
        );

        // One rectangle inside another
        let sel1 = A1Selection::test_a1("A1:D4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Nested rectangles should overlap"
        );

        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("B2:D4");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Nested rectangles should overlap"
        );

        // Overlapping columns
        let sel1 = A1Selection::test_a1("A:C");
        let sel2 = A1Selection::test_a1("B:D");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Overlapping columns should overlap"
        );

        // Non-overlapping columns
        let sel1 = A1Selection::test_a1("A:B");
        let sel2 = A1Selection::test_a1("C:D");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, &context),
            "Non-overlapping columns should not overlap"
        );

        // Overlapping rows
        let sel1 = A1Selection::test_a1("1:3");
        let sel2 = A1Selection::test_a1("2:4");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Overlapping rows should overlap"
        );

        // Non-overlapping rows
        let sel1 = A1Selection::test_a1("1:2");
        let sel2 = A1Selection::test_a1("3:4");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, &context),
            "Non-overlapping rows should not overlap"
        );

        // Single cell overlap
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("B2");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Single cell should overlap with containing rectangle"
        );

        // Multiple disjoint ranges with overlap
        let sel1 = A1Selection::test_a1("A1:C3,E1:G3");
        let sel2 = A1Selection::test_a1("B2:F2");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Disjoint ranges should overlap when intersecting"
        );

        // Multiple disjoint ranges without overlap
        let sel1 = A1Selection::test_a1("A1:B2,D1:E2");
        let sel2 = A1Selection::test_a1("F1:G2,H1:I2");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, &context),
            "Disjoint ranges should not overlap when separate"
        );

        // Complex overlapping selections
        let sel1 = A1Selection::test_a1("A1:C3,E:G,2:4");
        let sel2 = A1Selection::test_a1("B2:D4,F:H,3:5");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Complex selections should detect overlap correctly"
        );

        // All (*) overlaps with anything
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "All (*) should overlap with any selection"
        );

        // Row overlapping with rectangle
        let sel1 = A1Selection::test_a1("2:4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Row should overlap with intersecting rectangle"
        );

        // Column overlapping with rectangle
        let sel1 = A1Selection::test_a1("B:D");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, &context),
            "Column should overlap with intersecting rectangle"
        );
    }

    #[test]
    fn test_intersection_table_ref() {
        let context = A1Context::test(
            &[],
            &[("Table1", &["Col1", "Col2"], Rect::test_a1("A1:B4"))],
        );

        let sel1 = A1Selection::test_a1_context("Table1", &context);
        let sel2 = A1Selection::test_a1("A1:D4");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "A3:B4",
        );

        let sel1 = A1Selection::test_a1("A1:D4");
        let sel2 = A1Selection::test_a1_context("Table1", &context);
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "A1:B4",
        );

        let sel1 = A1Selection::test_a1("D1:E1");
        let sel2 = A1Selection::test_a1_context("Table1", &context);
        assert_eq!(sel1.intersection(&sel2, &context), None);
    }

    #[test]
    fn test_overlap_ref_range_bounds_table_ref() {
        let context = A1Context::test(
            &[],
            &[("Table1", &["Col1", "Col2"], Rect::test_a1("A1:B4"))],
        );

        // Test overlapping range with table
        let selection = A1Selection::test_a1_context("Table1[Col1]", &context);
        let CellRefRange::Table { range: table_ref } = &selection.ranges[0] else {
            panic!("Table range not found");
        };

        let range = RefRangeBounds::test_a1("A1:B4");
        assert!(
            A1Selection::overlap_ref_range_bounds_table_ref(&range, table_ref, &context),
            "Range should overlap with table"
        );

        // Test non-overlapping range with table
        let range = RefRangeBounds::test_a1("C1:D4");
        assert!(
            !A1Selection::overlap_ref_range_bounds_table_ref(&range, table_ref, &context),
            "Range should not overlap with table"
        );
    }

    #[test]
    fn test_intersects_rect() {
        let context = A1Context::default();

        // Simple rectangle intersection
        let sel = A1Selection::test_a1("B2:D4");
        assert!(
            sel.intersects_rect(Rect::test_a1("C3:E5"), &context),
            "Overlapping rectangles should intersect"
        );
        assert!(
            !sel.intersects_rect(Rect::test_a1("E5:F6"), &context),
            "Non-overlapping rectangles should not intersect"
        );

        // Edge touching
        let sel = A1Selection::test_a1("A1:B2");
        assert!(
            sel.intersects_rect(Rect::test_a1("B2:C3"), &context),
            "Edge-touching rectangles should intersect"
        );

        // Column range intersection
        let sel = A1Selection::test_a1("B:D");
        assert!(
            sel.intersects_rect(Rect::test_a1("C3:E5"), &context),
            "Column range should intersect with overlapping rect"
        );
        assert!(
            !sel.intersects_rect(Rect::test_a1("E5:F6"), &context),
            "Column range should not intersect with non-overlapping rect"
        );

        // Row range intersection
        let sel = A1Selection::test_a1("2:4");
        assert!(
            sel.intersects_rect(Rect::test_a1("C3:E5"), &context),
            "Row range should intersect with overlapping rect"
        );
        assert!(
            !sel.intersects_rect(Rect::test_a1("A6:B7"), &context),
            "Row range should not intersect with non-overlapping rect"
        );

        // All (*) intersection
        let sel = A1Selection::test_a1("*");
        assert!(
            sel.intersects_rect(Rect::test_a1("C3:E5"), &context),
            "All (*) should intersect with any rect"
        );

        // Multiple ranges - one intersects
        let sel = A1Selection::test_a1("A1:B2,E5:F6");
        assert!(
            sel.intersects_rect(Rect::test_a1("E5:G7"), &context),
            "Should intersect if any range intersects"
        );
        assert!(
            !sel.intersects_rect(Rect::test_a1("C3:D4"), &context),
            "Should not intersect if no range intersects"
        );
    }

    #[test]
    fn test_intersects_rect_table() {
        let context = A1Context::test(
            &[],
            &[("Table1", &["Col1", "Col2"], Rect::test_a1("A1:B4"))],
        );

        // Table range intersection
        let sel = A1Selection::test_a1_context("Table1", &context);
        assert!(
            sel.intersects_rect(Rect::test_a1("A1:C3"), &context),
            "Table should intersect with overlapping rect"
        );
        assert!(
            !sel.intersects_rect(Rect::test_a1("D5:E6"), &context),
            "Table should not intersect with non-overlapping rect"
        );

        // Table column intersection
        let sel = A1Selection::test_a1_context("Table1[Col1]", &context);
        assert!(
            sel.intersects_rect(Rect::test_a1("A3:B5"), &context),
            "Table column should intersect with overlapping rect"
        );
    }
}
