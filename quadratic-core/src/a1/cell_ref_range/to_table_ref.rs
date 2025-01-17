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
                x: range.start.col(),
                y: range.start.row(),
            };

            let end = SheetPos {
                sheet_id,
                x: range.end.col(),
                y: range.end.row(),
            };

            if let Some(table) = context.table_from_pos(start) {
                let b = table.bounds;

                // if the x value is outside the table, then it's not a table ref
                if start.x < b.min.x || end.x > b.max.x {
                    return None;
                }

                let col_range = if start.x == b.min.x && end.x == b.max.x {
                    ColRange::All
                } else if start.x == end.x {
                    let Some(col_name) = table.col_name_from_index(start.x as usize - 1) else {
                        return None;
                    };
                    ColRange::Col(col_name)
                } else {
                    let Some(col1_name) = table.col_name_from_index(start.x as usize - 1) else {
                        return None;
                    };
                    let Some(col2_name) = table.col_name_from_index(end.x as usize - 1) else {
                        return None;
                    };
                    ColRange::ColRange(col1_name, col2_name)
                };

                if b.min.y == start.y && b.max.y == end.y {
                    // full table
                    return Some(CellRefRange::Table {
                        range: TableRef {
                            table_name: table.table_name.clone(),
                            col_range,
                            data: true,
                            headers: true,
                            totals: false,
                        },
                    });
                } else if b.min.y + 1 == start.y && b.max.y == end.y {
                    // table without headers
                    return Some(CellRefRange::Table {
                        range: TableRef {
                            table_name: table.table_name.clone(),
                            col_range,
                            data: true,
                            headers: false,
                            totals: false,
                        },
                    });
                } else if start.y == b.min.y && end.y == b.min.y {
                    // table headers only
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
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A1:C3"),
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
            range: RefRangeBounds::test_a1("A2:C3"),
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
            range: RefRangeBounds::test_a1("A1:C1"),
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
    }

    #[test]
    fn test_check_for_table_ref_col_range() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("A2:B3"),
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
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let cell_ref_range = CellRefRange::Sheet {
            range: RefRangeBounds::test_a1("B2:B3"),
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
}
