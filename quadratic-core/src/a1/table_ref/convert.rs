use crate::a1::{A1Context, RefRangeBounds, UNBOUNDED};

use super::*;

impl TableRef {
    /// Converts the table ref to a list of CellRefRange::RefRangeBounds
    pub fn convert_to_ref_range_bounds(
        &self,
        use_unbounded: bool,
        context: &A1Context,
        force_columns: bool,
        force_table_bounds: bool,
    ) -> Option<RefRangeBounds> {
        let Some(table) = context.try_table(&self.table_name) else {
            // the table may no longer exist
            return None;
        };

        let (mut y_start, y_end) = table.to_sheet_rows();
        if !force_table_bounds {
            y_start += if !self.headers && !force_columns {
                table.y_adjustment(false)
            } else if table.show_ui && table.show_name {
                1
            } else {
                0
            };
        }
        let y_end = if !self.data { y_start } else { y_end };

        match &self.col_range {
            ColRange::All => {
                let range = RefRangeBounds::new_relative(
                    table.bounds.min.x,
                    y_start,
                    if use_unbounded {
                        UNBOUNDED
                    } else {
                        table.bounds.max.x
                    },
                    if use_unbounded { UNBOUNDED } else { y_end },
                );
                Some(range)
            }
            ColRange::Col(col) => table.try_col_index(col).map(|col| {
                RefRangeBounds::new_relative(
                    col + table.bounds.min.x,
                    y_start,
                    col + table.bounds.min.x,
                    if use_unbounded { UNBOUNDED } else { y_end },
                )
            }),
            ColRange::ColRange(col_range_start, col_range_end) => {
                if let Some((start, end)) = table.try_col_range(col_range_start, col_range_end) {
                    Some(RefRangeBounds::new_relative(
                        start + table.bounds.min.x,
                        y_start,
                        end + table.bounds.min.x,
                        if use_unbounded { UNBOUNDED } else { y_end },
                    ))
                } else {
                    None
                }
            }
            ColRange::ColToEnd(col) => {
                if let Some((start, end)) = table.try_col_range_to_end(col) {
                    Some(RefRangeBounds::new_relative(
                        start + table.bounds.min.x,
                        y_start,
                        if use_unbounded {
                            UNBOUNDED
                        } else {
                            end + table.bounds.min.x
                        },
                        if use_unbounded { UNBOUNDED } else { y_end },
                    ))
                } else {
                    None
                }
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::Rect;

    use super::*;

    fn create_test_context(rect: Rect) -> A1Context {
        A1Context::test(&[], &[("test_table", &["Col1", "Col2", "Col3"], rect)])
    }

    #[test]
    fn test_convert_all_columns() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:C4"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A2:C4"))
        );
    }

    #[test]
    fn test_convert_all_columns_without_header() {
        let mut context = create_test_context(Rect::test_a1("A1:C3"));
        context.table_map.tables.first_mut().unwrap().show_ui = false;

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A1:C3"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A1:C3"))
        );
    }

    #[test]
    fn test_convert_single_column() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Col1".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:A4"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Col1".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A2:A4"))
        );
    }

    #[test]
    fn test_convert_column_range() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("Col1".to_string(), "Col2".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:B4"))
        );
        assert_eq!(
            table_ref.convert_to_ref_range_bounds(true, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:B"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("Col1".to_string(), "Col2".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A2:B4"))
        );
    }

    #[test]
    fn test_convert_column_to_end() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("Col2".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("B3:C4"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("Col2".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("B2:C4"))
        );
    }

    #[test]
    fn test_convert_nonexistent_table() {
        let context = A1Context::default();

        let table_ref = TableRef {
            table_name: "nonexistent".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            None
        );
    }
}
