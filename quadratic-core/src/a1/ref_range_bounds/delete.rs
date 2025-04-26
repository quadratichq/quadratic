use crate::a1::{A1Context, CellRefCoord, CellRefRange, CellRefRangeEnd};

use super::RefRangeBounds;

impl RefRangeBounds {
    fn delete_ref_range_bounds(&self, range: &RefRangeBounds) -> Vec<CellRefRange> {
        // find any parts that need removing
        if let Some(intersection) = self.intersection(range) {
            // if the intersection is the same as the original range, then delete
            // everything
            if intersection == *self {
                vec![]
            } else {
                // otherwise, we need to delete the intersection
                let mut ranges = Vec::new();

                // check if there is a part above the intersection
                if intersection.start.row.coord > self.start.row.coord {
                    ranges.push(CellRefRange::Sheet {
                        range: RefRangeBounds {
                            start: CellRefRangeEnd {
                                col: self.start.col,
                                row: self.start.row,
                            },
                            end: CellRefRangeEnd {
                                col: self.end.col,
                                row: CellRefCoord {
                                    coord: intersection.start.row.coord - 1,
                                    is_absolute: self.start.row.is_absolute,
                                },
                            },
                        },
                    });
                }

                // check if there is a part below the intersection
                if intersection.end.row.coord < self.end.row.coord {
                    ranges.push(CellRefRange::Sheet {
                        range: RefRangeBounds {
                            start: CellRefRangeEnd {
                                col: self.start.col,
                                row: CellRefCoord {
                                    coord: intersection.end.row.coord + 1,
                                    is_absolute: self.start.row.is_absolute,
                                },
                            },
                            end: CellRefRangeEnd {
                                col: self.end.col,
                                row: self.end.row,
                            },
                        },
                    });
                }

                // check if there is a part to the left of the intersection
                if intersection.start.col.coord > self.start.col.coord {
                    ranges.push(CellRefRange::Sheet {
                        range: RefRangeBounds {
                            start: CellRefRangeEnd {
                                col: self.start.col,
                                row: self.start.row,
                            },
                            end: CellRefRangeEnd {
                                col: CellRefCoord {
                                    coord: intersection.start.col.coord - 1,
                                    is_absolute: self.start.col.is_absolute,
                                },
                                row: self.end.row,
                            },
                        },
                    });
                }

                // check if there is a part to the right of the intersection
                if intersection.end.col.coord < self.end.col.coord {
                    ranges.push(CellRefRange::Sheet {
                        range: RefRangeBounds {
                            start: CellRefRangeEnd {
                                col: CellRefCoord {
                                    coord: intersection.end.col.coord + 1,
                                    is_absolute: self.start.col.is_absolute,
                                },
                                row: self.start.row,
                            },
                            end: CellRefRangeEnd {
                                col: self.end.col,
                                row: self.end.row,
                            },
                        },
                    });
                }

                ranges
            }
        } else {
            vec![CellRefRange::Sheet {
                range: self.clone(),
            }]
        }
    }

    /// Deletes the given range from the current range. Returns the remaining
    /// range or None if the current range is completely deleted.
    pub fn delete(&self, range: &CellRefRange, a1_context: &A1Context) -> Vec<CellRefRange> {
        match range {
            CellRefRange::Sheet { range } => self.delete_ref_range_bounds(range),
            CellRefRange::Table { range } => {
                if let Some(bounds) =
                    range.convert_to_ref_range_bounds(false, a1_context, false, false)
                {
                    self.delete_ref_range_bounds(&bounds)
                } else {
                    vec![CellRefRange::Sheet {
                        range: self.clone(),
                    }]
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        TableRef,
        a1::{A1Context, CellRefCoord, CellRefRangeEnd, ColRange},
    };

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

    //     #[test]
    //     fn test_delete_with_table_range() {
    //         let range = RefRangeBounds::new_relative(1, 1, 5, 5);
    //         let table_range = CellRefRange::Table {
    //             range: TableRef {
    //                 table_name: "TestTable".to_string(),
    //                 col_range: ColRange::All,
    //             },
    //         };
    //         let a1_context = A1Context::default();
    //         let result = range.delete(&table_range, &a1_context);
    //         assert_eq!(result.len(), 1);
    //         let CellRefRange::Sheet { range: remaining } = result[0] else {
    //             panic!("expected a sheet range");
    //         };
    //         assert_eq!(remaining, range);
    //     }

    // #[test]
    // fn test_delete_with_absolute_references() {
    //     let range = RefRangeBounds {
    //         start: CellRefRangeEnd {
    //             col: CellRefCoord {
    //                 coord: 1,
    //                 is_absolute: true,
    //             },
    //             row: CellRefCoord {
    //                 coord: 1,
    //                 is_absolute: true,
    //             },
    //         },
    //         end: CellRefRangeEnd {
    //             col: CellRefCoord {
    //                 coord: 5,
    //                 is_absolute: true,
    //             },
    //             row: CellRefCoord {
    //                 coord: 5,
    //                 is_absolute: true,
    //             },
    //         },
    //     };
    //     let to_delete = RefRangeBounds::new_relative(2, 2, 4, 4);
    //     let result = range.delete_ref_range_bounds(&to_delete);
    //     assert_eq!(result.len(), 4);

    //     // Verify absolute references are preserved
    //     for r in result {
    //         assert!(r.range.start.col.is_absolute);
    //         assert!(r.range.start.row.is_absolute);
    //         assert!(r.range.end.col.is_absolute);
    //         assert!(r.range.end.row.is_absolute);
    //     }
    // }
}
