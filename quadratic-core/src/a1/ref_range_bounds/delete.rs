use crate::a1::{A1Context, A1Selection, CellRefRange};

use super::RefRangeBounds;

impl RefRangeBounds {
    fn delete_ref_range_bounds(&self, range: &RefRangeBounds) -> Vec<CellRefRange> {
        // if there is no intersection, return the original range
        if self.intersection(range).is_none() {
            return vec![CellRefRange::Sheet { range: *self }];
        }

        // find any parts that need removing
        let exclude = range.to_rect_unbounded();

        // we need a copy since we mutate it to normalize it
        A1Selection::find_excluded_rects(*self, exclude)
    }

    /// Deletes the given range from the current range. Returns the remaining
    /// range or None if the current range is completely deleted.
    pub(crate) fn delete(&self, range: &CellRefRange, a1_context: &A1Context) -> Vec<CellRefRange> {
        match range {
            CellRefRange::Sheet { range } => self.delete_ref_range_bounds(range),
            CellRefRange::Table { range } => {
                if let Some(bounds) =
                    range.convert_to_ref_range_bounds(false, a1_context, false, false)
                {
                    self.delete_ref_range_bounds(&bounds)
                } else {
                    vec![CellRefRange::Sheet { range: *self }]
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{TableRef, a1::A1Context};

    #[test]
    fn test_delete_complete_overlap() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let to_delete = RefRangeBounds::new_relative(1, 1, 5, 5);
        let result = range.delete_ref_range_bounds(&to_delete);
        assert!(result.is_empty());
    }

    #[test]
    fn test_delete_no_overlap() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let to_delete = RefRangeBounds::new_relative(6, 6, 10, 10);
        let result = range.delete_ref_range_bounds(&to_delete);
        assert_eq!(result.len(), 1);
        let CellRefRange::Sheet { range: remaining } = result[0] else {
            panic!("expected a sheet range");
        };
        assert_eq!(remaining, range);
    }

    #[test]
    fn test_delete_partial_overlap_top() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let to_delete = RefRangeBounds::new_relative(1, 1, 5, 3);
        let result = range.delete_ref_range_bounds(&to_delete);
        assert_eq!(result.len(), 1);
        let CellRefRange::Sheet { range: remaining } = result[0] else {
            panic!("expected a sheet range");
        };
        assert_eq!(remaining, RefRangeBounds::new_relative(1, 4, 5, 5));
    }

    #[test]
    fn test_delete_partial_overlap_bottom() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let to_delete = RefRangeBounds::new_relative(1, 3, 5, 5);
        let result = range.delete_ref_range_bounds(&to_delete);
        assert_eq!(result.len(), 1);
        let CellRefRange::Sheet { range: remaining } = result[0] else {
            panic!("expected a sheet range");
        };
        assert_eq!(remaining, RefRangeBounds::new_relative(1, 1, 5, 2));
    }

    #[test]
    fn test_delete_partial_overlap_left() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let to_delete = RefRangeBounds::new_relative(1, 1, 3, 5);
        let result = range.delete_ref_range_bounds(&to_delete);
        assert_eq!(result.len(), 1);
        let CellRefRange::Sheet { range: remaining } = result[0] else {
            panic!("expected a sheet range");
        };
        assert_eq!(remaining, RefRangeBounds::new_relative(4, 1, 5, 5));
    }

    #[test]
    fn test_delete_partial_overlap_right() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let to_delete = RefRangeBounds::new_relative(3, 1, 5, 5);
        let result = range.delete_ref_range_bounds(&to_delete);
        assert_eq!(result.len(), 1);
        let CellRefRange::Sheet { range: remaining } = result[0] else {
            panic!("expected a sheet range");
        };
        assert_eq!(remaining, RefRangeBounds::new_relative(1, 1, 2, 5));
    }

    #[test]
    fn test_delete_center() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let to_delete = RefRangeBounds::new_relative(2, 2, 4, 4);
        let result = range.delete_ref_range_bounds(&to_delete);
        assert_eq!(result.len(), 4);

        // Top part
        assert!(result.iter().any(|r| {
            let CellRefRange::Sheet { range } = r else {
                panic!("expected a sheet range");
            };
            *range == RefRangeBounds::new_relative(1, 1, 5, 1)
        }));
        // Bottom part
        assert!(result.iter().any(|r| {
            let CellRefRange::Sheet { range } = r else {
                panic!("expected a sheet range");
            };
            *range == RefRangeBounds::new_relative(1, 5, 5, 5)
        }));

        // Left part
        assert!(result.iter().any(|r| {
            let CellRefRange::Sheet { range } = r else {
                panic!("expected a sheet range");
            };
            *range == RefRangeBounds::new_relative(1, 2, 1, 4)
        }));
        // Right part
        assert!(result.iter().any(|r| {
            let CellRefRange::Sheet { range } = r else {
                panic!("expected a sheet range");
            };
            *range == RefRangeBounds::new_relative(5, 2, 5, 4)
        }));
    }

    #[test]
    fn test_delete_with_table_range() {
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let table_range = CellRefRange::Table {
            range: TableRef::new("TestTable"),
        };
        let a1_context = A1Context::default();
        let result = range.delete(&table_range, &a1_context);
        assert_eq!(result.len(), 1);
        let CellRefRange::Sheet { range: remaining } = result[0] else {
            panic!("expected a sheet range");
        };
        assert_eq!(remaining, range);
    }
}
