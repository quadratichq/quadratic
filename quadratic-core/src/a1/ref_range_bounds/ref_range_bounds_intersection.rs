use super::*;

impl RefRangeBounds {
    /// Find intersection between two CellRefRanges.
    pub fn intersection(&self, other: &RefRangeBounds) -> Option<Self> {
        // If either range is empty/invalid, no intersection
        if !self.is_valid() || !other.is_valid() {
            return None;
        }

        // Handle all-* cases
        if self.is_all() {
            return Some(*other);
        }
        if other.is_all() {
            return Some(*self);
        }

        // Handle single cell cases
        if self.is_single_cell() {
            return if other.contains_pos(self.try_to_pos().unwrap()) {
                Some(*self)
            } else {
                None
            };
        }
        if other.is_single_cell() {
            return if self.contains_pos(other.try_to_pos().unwrap()) {
                Some(*other)
            } else {
                None
            };
        }

        // Convert both ranges to their bounding coordinates
        let (self_min_col, self_max_col) = self.column_bounds();
        let (self_min_row, self_max_row) = self.row_bounds();
        let (other_min_col, other_max_col) = other.column_bounds();
        let (other_min_row, other_max_row) = other.row_bounds();

        // Find intersection
        let min_col = self_min_col.max(other_min_col);
        let max_col = self_max_col.min(other_max_col);
        let min_row = self_min_row.max(other_min_row);
        let max_row = self_max_row.min(other_max_row);

        // Check if there is a valid intersection
        if min_col <= max_col && min_row <= max_row {
            match (
                self.is_column_range(),
                self.is_row_range(),
                other.is_column_range(),
                other.is_row_range(),
            ) {
                // Both are column ranges (including partial)
                (true, false, true, false) => {
                    let end_row = if max_row == i64::MAX && min_row == 1 {
                        i64::MAX
                    } else {
                        i64::MAX
                    };
                    Some(RefRangeBounds::new_relative(
                        min_col,
                        min_row,
                        if min_col == max_col { min_col } else { max_col },
                        end_row,
                    ))
                }
                // Both are row ranges (including partial)
                (false, true, false, true) => {
                    let end_col = if max_col == i64::MAX && min_col == 1 {
                        i64::MAX
                    } else {
                        i64::MAX
                    };
                    Some(RefRangeBounds::new_relative(
                        min_col,
                        min_row,
                        end_col,
                        if min_row == max_row { min_row } else { max_row },
                    ))
                }
                // Mixed types (including partial ranges)
                _ => Some(RefRangeBounds::new_relative(
                    min_col,
                    min_row,
                    if max_col == i64::MAX {
                        i64::MAX
                    } else {
                        max_col
                    },
                    if max_row == i64::MAX {
                        i64::MAX
                    } else {
                        max_row
                    },
                )),
            }
        } else {
            None
        }
    }

    // Helper methods to get bounds.
    fn column_bounds(&self) -> (i64, i64) {
        if self.is_column_range() {
            let start_col = self.start.col.map(|c| c.coord).unwrap_or(1);
            let end_col = self
                .end
                .as_ref()
                .and_then(|e| e.col.map(|c| c.coord))
                .unwrap_or(start_col);
            (start_col.min(end_col), start_col.max(end_col))
        } else if self.start.col.is_some() {
            let start_col = self.start.col.map(|c| c.coord).unwrap();
            let end_col = self
                .end
                .as_ref()
                .and_then(|e| e.col.map(|c| c.coord))
                .unwrap_or(start_col);
            (start_col.min(end_col), start_col.max(end_col))
        } else {
            (0, i64::MAX)
        }
    }

    fn row_bounds(&self) -> (i64, i64) {
        if self.is_row_range() {
            let start_row = self.start.row.map(|r| r.coord).unwrap_or(1);
            let end_row = self
                .end
                .as_ref()
                .and_then(|e| e.row.map(|r| r.coord))
                .unwrap_or(start_row);
            (start_row.min(end_row), start_row.max(end_row))
        } else if self.start.row.is_some() {
            let start_row = self.start.row.map(|r| r.coord).unwrap();
            let end_row = self
                .end
                .as_ref()
                .and_then(|e| e.row.map(|r| r.coord))
                .unwrap_or(start_row);
            (start_row.min(end_row), start_row.max(end_row))
        } else {
            (0, i64::MAX)
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_intersection_pos_pos() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").intersection(&RefRangeBounds::test_a1("A1")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1").intersection(&RefRangeBounds::test_a1("B1")),
            None
        );
    }

    #[test]
    fn test_intersection_pos_rect() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").intersection(&RefRangeBounds::test_a1("A1:B2")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").intersection(&RefRangeBounds::test_a1("A1")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("C1").intersection(&RefRangeBounds::test_a1("A1:B2")),
            None
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").intersection(&RefRangeBounds::test_a1("C1")),
            None
        );
    }

    #[test]
    fn test_intersection_rect_rect() {
        // Test range intersections
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("B2:D4")),
            Some(RefRangeBounds::test_a1("B2:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").intersection(&RefRangeBounds::test_a1("C3:D4")),
            None
        );
        assert_eq!(
            RefRangeBounds::test_a1("B2:A1").intersection(&RefRangeBounds::test_a1("A1:C3")),
            Some(RefRangeBounds::test_a1("A1:B2"))
        );
    }

    #[test]
    fn test_intersection_col_col() {
        assert_eq!(
            RefRangeBounds::test_a1("A").intersection(&RefRangeBounds::test_a1("A")),
            Some(RefRangeBounds::test_a1("A"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A").intersection(&RefRangeBounds::test_a1("B")),
            None
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:C").intersection(&RefRangeBounds::test_a1("B:D")),
            Some(RefRangeBounds::test_a1("B:C"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:C").intersection(&RefRangeBounds::test_a1("C:D")),
            Some(RefRangeBounds::test_a1("C"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").intersection(&RefRangeBounds::test_a1("C:D")),
            None
        );
    }

    #[test]
    fn test_intersection_row_row() {
        assert_eq!(
            RefRangeBounds::test_a1("1").intersection(&RefRangeBounds::test_a1("1")),
            Some(RefRangeBounds::test_a1("1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("1").intersection(&RefRangeBounds::test_a1("2")),
            None
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:3").intersection(&RefRangeBounds::test_a1("2:4")),
            Some(RefRangeBounds::test_a1("2:3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:2").intersection(&RefRangeBounds::test_a1("3:4")),
            None
        );
    }

    #[test]
    fn test_intersection_col_row() {
        assert_eq!(
            RefRangeBounds::test_a1("B:C").intersection(&RefRangeBounds::test_a1("2:3")),
            Some(RefRangeBounds::test_a1("B2:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("2:3").intersection(&RefRangeBounds::test_a1("B:C")),
            Some(RefRangeBounds::test_a1("B2:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").intersection(&RefRangeBounds::test_a1("3")),
            Some(RefRangeBounds::test_a1("A3:B3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("3").intersection(&RefRangeBounds::test_a1("A:B")),
            Some(RefRangeBounds::test_a1("A3:B3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:2").intersection(&RefRangeBounds::test_a1("B")),
            Some(RefRangeBounds::test_a1("B1:B2"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("B").intersection(&RefRangeBounds::test_a1("1:2")),
            Some(RefRangeBounds::test_a1("B1:B2"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("1").intersection(&RefRangeBounds::test_a1("A")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("10").intersection(&RefRangeBounds::test_a1("ZZ")),
            Some(RefRangeBounds::test_a1("ZZ10"))
        );
    }

    #[test]
    fn test_intersection_range() {
        // Test row range intersections
        assert_eq!(
            RefRangeBounds::test_a1("1:3").intersection(&RefRangeBounds::test_a1("2:4")),
            Some(RefRangeBounds::test_a1("2:3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:2").intersection(&RefRangeBounds::test_a1("3:4")),
            None
        );

        // Test mixed range intersections
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("B:D")),
            Some(RefRangeBounds::test_a1("B1:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("2:4")),
            Some(RefRangeBounds::test_a1("A2:C3"))
        );

        // Test with unbounded ranges
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("*")),
            Some(RefRangeBounds::test_a1("A1:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").intersection(&RefRangeBounds::test_a1("B2:D4")),
            Some(RefRangeBounds::test_a1("B2:D4"))
        );
    }

    #[test]
    fn test_intersection_partial_cols_rows() {
        assert_eq!(
            RefRangeBounds::test_a1("A3:C").intersection(&RefRangeBounds::test_a1("B:D")),
            Some(RefRangeBounds::test_a1("B3:C"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("B:D").intersection(&RefRangeBounds::test_a1("A3:C")),
            Some(RefRangeBounds::test_a1("B3:C"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A3:5").intersection(&RefRangeBounds::test_a1("2:4")),
            Some(RefRangeBounds::test_a1("A3:4"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("2:4").intersection(&RefRangeBounds::test_a1("A3:5")),
            Some(RefRangeBounds::test_a1("A3:4"))
        );
    }
}