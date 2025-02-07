use crate::{a1::ColRange, grid::SheetId, SheetPos};

use super::*;

impl CellRefRange {
    /// Checks if a CellRefRange::Sheet can be converted to a
    /// CellRefRange::Table. If it can, then it returns the TableRef.
    pub fn check_for_table_ref(
        &self,
        sheet_id: SheetId,
        context: &A1Context,
    ) -> Option<CellRefRange> {
        if let CellRefRange::Sheet { range } = self {
            // if the range is unbounded, then it's not a table ref
            if !range.is_finite() {
                return None;
            }
            let start = SheetPos {
                sheet_id,
                x: range.start.col().min(range.end.col()),
                y: range.start.row().min(range.end.row()),
            };

            let end = SheetPos {
                sheet_id,
                x: range.end.col().max(range.start.col()),
                y: range.end.row().max(range.start.row()),
            };

            dbgjs!(format!("start: {:?}", start));
            dbgjs!(format!("end: {:?}", end));

            if let Some(table) = context.table_from_pos(start) {
                let b = table.bounds;
                dbgjs!(format!("table: {:?}", table));
                dbgjs!(format!("b: {:?}", b));
                dbgjs!(format!(
                    "start == end
                    && table.show_ui
                    && table.show_name
                    && start.x >= b.min.x
                    && start.x <= b.max.x
                    && start.y == b.min.y: {:?}",
                    start == end
                        && table.show_ui
                        && table.show_name
                        && start.x >= b.min.x
                        && start.x <= b.max.x
                        && start.y == b.min.y
                ));

                // if we're in the name cell of the table, then we should return the table ref
                if start == end
                    && table.show_ui
                    && table.show_name
                    && start.x >= b.min.x
                    && start.x <= b.max.x
                    && start.y == b.min.y
                {
                    return Some(CellRefRange::Table {
                        range: TableRef {
                            table_name: table.table_name.clone(),
                            col_range: ColRange::All,
                            data: true,
                            headers: false,
                            totals: false,
                        },
                    });
                }

                if table.is_html_image && b.contains(start.into()) && b.contains(end.into()) {
                    return Some(CellRefRange::Table {
                        range: TableRef {
                            table_name: table.table_name.clone(),
                            col_range: ColRange::All,
                            data: true,
                            headers: false,
                            totals: false,
                        },
                    });
                }

                dbgjs!(format!(
                    "start.x < b.min.x || end.x > b.max.x: {:?}",
                    start.x < b.min.x || end.x > b.max.x
                ));

                // if the x value is outside the table, then it's not a table ref
                if start.x < b.min.x || end.x > b.max.x {
                    return None;
                }

                let col_range = if start.x == b.min.x && end.x == b.max.x {
                    ColRange::All
                } else if start.x == end.x {
                    let col_name =
                        table.col_name_from_index(start.x as usize - b.min.x as usize)?;
                    ColRange::Col(col_name)
                } else {
                    let col1_name =
                        table.col_name_from_index(start.x as usize - b.min.x as usize)?;
                    let col2_name = table.col_name_from_index(end.x as usize - b.min.x as usize)?;
                    ColRange::ColRange(col1_name, col2_name)
                };

                dbgjs!(format!(
                    "table.show_ui
                    && table.show_columns
                    && start.y == b.min.y + (if table.show_name {{ 1 }} else {{ 0 }})
                    && end.y == b.min.y + (if table.show_name {{ 1 }} else {{ 0 }}): {:?}",
                    table.show_ui
                        && table.show_columns
                        && start.y == b.min.y + (if table.show_name { 1 } else { 0 })
                        && end.y == b.min.y + (if table.show_name { 1 } else { 0 })
                ));

                // only column headers
                if table.show_ui
                    && table.show_columns
                    && start.y == b.min.y + (if table.show_name { 1 } else { 0 })
                    && end.y == b.min.y + (if table.show_name { 1 } else { 0 })
                {
                    return Some(CellRefRange::Table {
                        range: TableRef {
                            table_name: table.table_name.clone(),
                            col_range,
                            data: false,
                            headers: true,
                            totals: false,
                        },
                    });
                }

                // only data
                if start.y
                    == b.min.y
                        + (if table.show_ui && table.show_name {
                            1
                        } else {
                            0
                        })
                        + (if table.show_ui && table.show_columns {
                            1
                        } else {
                            0
                        })
                    && end.y == b.max.y
                {
                    return Some(CellRefRange::Table {
                        range: TableRef {
                            table_name: table.table_name.clone(),
                            col_range,
                            data: true,
                            headers: false,
                            totals: false,
                        },
                    });
                }

                dbgjs!(format!(
                    "start.y
                    == b.min.y
                        + (if table.show_ui && table.show_name {{ 1 }} else {{ 0 }}): {:?}",
                    start.y
                        == b.min.y
                            + (if table.show_ui && table.show_name {
                                1
                            } else {
                                0
                            })
                ));

                // data and column headers
                if start.y
                    == b.min.y
                        + (if table.show_ui && table.show_name {
                            1
                        } else {
                            0
                        })
                    && end.y == b.max.y
                {
                    return Some(CellRefRange::Table {
                        range: TableRef {
                            table_name: table.table_name.clone(),
                            col_range,
                            data: true,
                            headers: true,
                            totals: false,
                        },
                    });
                }
            }
        }
        None
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_check_for_table_ref_full_table() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C4"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A2:C4"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);

        assert_eq!(
            table_ref,
            Some(CellRefRange::Table {
                range: TableRef {
                    table_name: "Table1".to_string(),
                    col_range: ColRange::All,
                    data: true,
                    headers: true,
                    totals: false,
                },
            })
        );
    }

    #[test]
    fn test_check_for_table_ref_data() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A3:C3"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);

        assert_eq!(
            table_ref,
            Some(CellRefRange::Table {
                range: TableRef {
                    table_name: "Table1".to_string(),
                    col_range: ColRange::All,
                    data: true,
                    headers: false,
                    totals: false,
                },
            })
        );
    }

    #[test]
    fn test_check_for_table_ref_headers() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A2:C2"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);

        assert_eq!(
            table_ref,
            Some(CellRefRange::Table {
                range: TableRef {
                    table_name: "Table1".to_string(),
                    col_range: ColRange::All,
                    data: false,
                    headers: true,
                    totals: false,
                },
            })
        );

        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("B2"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);

        assert_eq!(
            table_ref,
            Some(CellRefRange::Table {
                range: TableRef {
                    table_name: "Table1".to_string(),
                    col_range: ColRange::Col("col2".to_string()),
                    data: false,
                    headers: true,
                    totals: false,
                },
            })
        );
    }

    #[test]
    fn test_check_for_table_ref_col_range() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A3:B3"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);

        assert_eq!(
            table_ref,
            Some(CellRefRange::Table {
                range: TableRef {
                    table_name: "Table1".to_string(),
                    col_range: ColRange::ColRange("col1".to_string(), "col2".to_string()),
                    data: true,
                    headers: false,
                    totals: false,
                },
            })
        );
    }

    #[test]
    fn test_check_for_table_ref_col() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("D5:F10"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("E10:E7"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);

        assert_eq!(
            table_ref,
            Some(CellRefRange::Table {
                range: TableRef {
                    table_name: "Table1".to_string(),
                    col_range: ColRange::Col("col2".to_string()),
                    data: true,
                    headers: false,
                    totals: false,
                },
            })
        );
    }

    #[test]
    fn test_check_for_table_ref_hidden_ui() {
        let mut context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2"], Rect::test_a1("A1:B3"))],
        );

        // Modify the table to hide UI elements
        if let Some(table) = context.table_mut("Table1") {
            table.show_ui = false;
            table.show_columns = false;
        }

        // Try to get data without headers - should return None since UI is hidden
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A2:B3"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);
        assert_eq!(table_ref, None);

        // Try to get headers only - should return None since columns are hidden
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A1:B1"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);
        assert_eq!(table_ref, None);
    }

    #[test]
    fn test_check_for_table_ref_hidden_columns() {
        let mut context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2"], Rect::test_a1("A1:B3"))],
        );

        // Modify the table to hide only columns but keep UI
        if let Some(table) = context.table_mut("Table1") {
            table.show_ui = true;
            table.show_columns = false;
        }

        // Try to get headers only - should return None since columns are hidden
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A1:B1"),
        };
        let table_ref = cell_ref_range.check_for_table_ref(SheetId::test(), &context);
        assert_eq!(table_ref, None);
    }
}
