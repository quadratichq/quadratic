use crate::a1::{A1Context, A1Selection, CellRefRange, RefRangeBounds};

use super::TableRef;

impl TableRef {
    fn delete_ref_range_bounds(
        &self,
        to_delete: &RefRangeBounds,
        a1_context: &A1Context,
    ) -> Vec<CellRefRange> {
        // first return self if there is no overlap (or we can't calculate the
        // rect)
        if let Some(bounds) = self.convert_to_ref_range_bounds(false, a1_context, false, false) {
            if bounds.intersection(to_delete).is_some() {
                let remaining =
                    A1Selection::find_excluded_rects(bounds, to_delete.to_rect_unbounded());

                if let Some(table) = a1_context.try_table_by_id(self.table_id) {
                    remaining
                        .into_iter()
                        .map(|r| {
                            if let Some(table_ref) =
                                r.check_for_table_ref(table.sheet_id, a1_context)
                            {
                                table_ref
                            } else {
                                r
                            }
                        })
                        .collect()
                } else {
                    vec![]
                }
            } else {
                vec![CellRefRange::Table {
                    range: self.clone(),
                }]
            }
        } else {
            vec![CellRefRange::Table {
                range: self.clone(),
            }]
        }
    }

    pub fn delete(&self, range: &CellRefRange, a1_context: &A1Context) -> Vec<CellRefRange> {
        match range {
            CellRefRange::Sheet { range } => self.delete_ref_range_bounds(range, a1_context),
            CellRefRange::Table { range } => {
                if let Some(range) =
                    range.convert_to_ref_range_bounds(false, a1_context, false, false)
                {
                    self.delete_ref_range_bounds(&range, a1_context)
                } else {
                    vec![]
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        TableRef,
        a1::{A1Selection, CellRefRange, ColRange, RefRangeBounds},
        controller::GridController,
        test_util::*,
    };

    /// Creates a table with 3 rows and 3 columns with a name of "test_table" at B2
    fn setup_3x3_test_table_at_b2() -> (GridController, TableRef) {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![b2], 3, 3);

        let selection = A1Selection::test_a1_context("test_table", gc.a1_context());
        let CellRefRange::Table { range: table_range } = &selection.ranges[0] else {
            panic!("Expected a table ref");
        };

        (gc, table_range.clone())
    }

    #[test]
    fn test_delete_all_from_table_from_selection() {
        let (gc, table_range) = setup_3x3_test_table_at_b2();

        let remove_all = A1Selection::test_a1("*");

        let result = table_range.delete(&remove_all.ranges[0], gc.a1_context());
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_delete_entire_table_via_range_from_selection() {
        let (gc, table_range) = setup_3x3_test_table_at_b2();

        let remove_all = A1Selection::test_a1("A1:E10");

        let result = table_range.delete(&remove_all.ranges[0], gc.a1_context());
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_delete_first_column_from_selection() {
        let (gc, table_range) = setup_3x3_test_table_at_b2();
        let table_id = table_range.table_id;
        let remove_first_column = A1Selection::test_a1("B1:B6");

        let result = table_range.delete(&remove_first_column.ranges[0], gc.a1_context());
        assert_eq!(result.len(), 1);
        let CellRefRange::Table { range: table_range } = &result[0] else {
            panic!("Expected a table ref");
        };
        assert_eq!(
            table_range,
            &TableRef {
                table_id,
                col_range: ColRange::ColRange("Column 2".to_string(), "Column 3".to_string()),
                data: true,
                headers: false,
                totals: false,
            }
        );
    }

    #[test]
    fn test_delete_second_column_from_selection() {
        let (gc, table_range) = setup_3x3_test_table_at_b2();
        let table_id = table_range.table_id;
        let remove_second_column = A1Selection::test_a1("C1:C6");

        let result = table_range.delete(&remove_second_column.ranges[0], gc.a1_context());
        assert_eq!(result.len(), 2);
        assert_eq!(
            result[0],
            CellRefRange::Table {
                range: TableRef {
                    table_id,
                    col_range: ColRange::Col("Column 1".to_string()),
                    data: true,
                    headers: false,
                    totals: false,
                }
            }
        );
        assert_eq!(
            result[1],
            CellRefRange::Table {
                range: TableRef {
                    table_id,
                    col_range: ColRange::Col("Column 3".to_string()),
                    data: true,
                    headers: false,
                    totals: false,
                }
            }
        );
    }

    #[test]
    fn test_delete_first_row_from_selection() {
        let (gc, table_range) = setup_3x3_test_table_at_b2();
        let remove_first_row = A1Selection::test_a1("B4:D4");

        let result = table_range.delete(&remove_first_row.ranges[0], gc.a1_context());
        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0],
            CellRefRange::Sheet {
                range: RefRangeBounds::test_a1("B5:D6")
            }
        );
    }

    #[test]
    fn test_delete_table_column_from_selection() {
        let (gc, table_range) = setup_3x3_test_table_at_b2();
        let table_id = table_range.table_id;
        let remove_first_column =
            A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());

        let result = table_range.delete(&remove_first_column.ranges[0], gc.a1_context());
        assert_eq!(result.len(), 1);
        let CellRefRange::Table { range: table_range } = &result[0] else {
            panic!("Expected a table ref");
        };
        assert_eq!(
            table_range,
            &TableRef {
                table_id,
                col_range: ColRange::ColRange("Column 2".to_string(), "Column 3".to_string()),
                data: true,
                headers: false,
                totals: false,
            }
        );
    }

    #[test]
    fn test_delete_sheet_from_table_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let to_delete = A1Selection::test_a1_context("B4:C5", gc.a1_context());
        let result = selection.delete_selection(&to_delete, gc.a1_context());
        assert!(result.is_none());
    }
}
