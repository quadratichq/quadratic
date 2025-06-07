use crate::{
    SheetPos,
    a1::A1Context,
    grid::{SheetId, sheet::data_tables::cache::SheetDataTablesCache},
    input::has_content::{
        column_bounds, has_content_ignore_blank_table, is_at_table_edge_col, is_at_table_edge_row,
        row_bounds,
    },
    wasm_bindings::sheet_content_cache::SheetContentCache,
};

/// finds the nearest column with or without content
/// if reverse is true it searches to the left of the start
/// if with_content is true it searches for a column with content; otherwise it searches for a column without content
///
/// For charts, is uses the chart's bounds for intersection test (since charts are considered a single cell)
///
/// Returns the found column matching the criteria of with_content
pub(crate) fn find_next_column(
    sheet_id: SheetId,
    column_start: i64,
    row: i64,
    reverse: bool,
    with_content: bool,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> Option<i64> {
    let Some(bounds) = row_bounds(row, content_cache, table_cache) else {
        return if with_content {
            None
        } else {
            Some(column_start)
        };
    };
    let mut x = column_start;
    let mut at_table_edge = false;
    while (reverse && x >= bounds.0) || (!reverse && x <= bounds.1) {
        let has_content = has_content_ignore_blank_table(
            SheetPos {
                x,
                y: row,
                sheet_id,
            },
            content_cache,
            table_cache,
        );

        // add edges of data tables to the search
        at_table_edge = is_at_table_edge_col(
            SheetPos {
                x,
                y: row,
                sheet_id,
            },
            table_cache,
            context,
        );

        if at_table_edge {
            return Some(
                x + if with_content {
                    0
                } else if reverse {
                    -1
                } else {
                    1
                },
            );
        }

        if has_content {
            if with_content {
                return Some(x);
            }
        } else if !with_content {
            return Some(x);
        }
        x += if reverse { -1 } else { 1 };
    }

    // final check when we've exited the loop
    let has_content = has_content_ignore_blank_table(
        SheetPos {
            x,
            y: row,
            sheet_id,
        },
        content_cache,
        table_cache,
    ) || at_table_edge;
    if with_content == has_content {
        Some(x)
    } else {
        None
    }
}

/// finds the next column with or without content if reverse is true it
/// searches to the left of the start if with_content is true it searches
/// for a column with content; otherwise it searches for a column without
/// content
///
/// Returns the found row matching the criteria of with_content
pub(crate) fn find_next_row(
    sheet_id: SheetId,
    row_start: i64,
    column: i64,
    reverse: bool,
    with_content: bool,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> Option<i64> {
    let Some(bounds) = column_bounds(column, content_cache, table_cache) else {
        return if with_content { None } else { Some(row_start) };
    };
    let mut y = row_start;
    let mut at_table_edge = false;
    while (reverse && y >= bounds.0) || (!reverse && y <= bounds.1) {
        let has_content = has_content_ignore_blank_table(
            SheetPos {
                x: column,
                y,
                sheet_id,
            },
            content_cache,
            table_cache,
        );

        // add edges of data tables to the search
        at_table_edge = is_at_table_edge_row(
            SheetPos {
                x: column,
                y,
                sheet_id,
            },
            table_cache,
            context,
        );

        if at_table_edge {
            return Some(
                y + if with_content {
                    0
                } else if reverse {
                    -1
                } else {
                    1
                },
            );
        }

        if has_content {
            if with_content {
                return Some(y);
            }
        } else if !with_content {
            return Some(y);
        }
        y += if reverse { -1 } else { 1 };
    }

    // final check when we've exited the loop
    let has_content = has_content_ignore_blank_table(
        SheetPos {
            x: column,
            y,
            sheet_id,
        },
        content_cache,
        table_cache,
    ) || at_table_edge;
    if with_content == has_content {
        Some(y)
    } else {
        None
    }
}

// #[cfg(test)]
// mod test {
//     use crate::{
//         CellValue, Pos, Value,
//         grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind, Sheet},
//     };

//     #[test]
//     fn test_find_next_column() {
//         let mut sheet = Sheet::test();

//         sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text(String::from("test")));
//         sheet.set_cell_value(Pos { x: 10, y: 10 }, CellValue::Text(String::from("test")));

//         assert_eq!(sheet.find_next_column(0, 0, false, false), Some(0));
//         assert_eq!(sheet.find_next_column(0, 0, false, true), None);
//         assert_eq!(sheet.find_next_column(0, 0, true, false), Some(0));
//         assert_eq!(sheet.find_next_column(0, 0, true, true), None);
//         assert_eq!(sheet.find_next_column(-1, 2, false, true), Some(1));
//         assert_eq!(sheet.find_next_column(-1, 2, true, true), None);
//         assert_eq!(sheet.find_next_column(3, 2, false, true), None);
//         assert_eq!(sheet.find_next_column(3, 2, true, true), Some(1));
//         assert_eq!(sheet.find_next_column(2, 2, false, true), None);
//         assert_eq!(sheet.find_next_column(2, 2, true, true), Some(1));
//         assert_eq!(sheet.find_next_column(0, 2, false, true), Some(1));
//         assert_eq!(sheet.find_next_column(0, 2, true, true), None);
//         assert_eq!(sheet.find_next_column(1, 2, false, false), Some(2));
//         assert_eq!(sheet.find_next_column(1, 2, true, false), Some(0));

//         sheet.set_cell_value(Pos { x: 2, y: 2 }, CellValue::Text(String::from("test")));
//         sheet.set_cell_value(Pos { x: 3, y: 2 }, CellValue::Text(String::from("test")));

//         assert_eq!(sheet.find_next_column(1, 2, false, false), Some(4));
//         assert_eq!(sheet.find_next_column(2, 2, false, false), Some(4));
//         assert_eq!(sheet.find_next_column(2, 2, true, false), Some(0));
//         assert_eq!(sheet.find_next_column(3, 2, true, false), Some(0));
//     }

//     #[test]
//     fn test_find_next_row() {
//         let mut sheet = Sheet::test();

//         let _ = sheet.set_cell_value(Pos { x: 2, y: 1 }, CellValue::Text(String::from("test")));
//         sheet.set_cell_value(Pos { x: 10, y: 10 }, CellValue::Text(String::from("test")));

//         assert_eq!(sheet.find_next_row(0, 0, false, false), Some(0));
//         assert_eq!(sheet.find_next_row(0, 0, false, true), None);
//         assert_eq!(sheet.find_next_row(0, 0, true, false), Some(0));
//         assert_eq!(sheet.find_next_row(0, 0, true, true), None);
//         assert_eq!(sheet.find_next_row(-1, 2, false, true), Some(1));
//         assert_eq!(sheet.find_next_row(-1, 2, true, true), None);
//         assert_eq!(sheet.find_next_row(3, 2, false, true), None);
//         assert_eq!(sheet.find_next_row(3, 2, true, true), Some(1));
//         assert_eq!(sheet.find_next_row(2, 2, false, true), None);
//         assert_eq!(sheet.find_next_row(2, 2, true, true), Some(1));
//         assert_eq!(sheet.find_next_row(0, 2, false, true), Some(1));
//         assert_eq!(sheet.find_next_row(0, 2, true, true), None);
//         assert_eq!(sheet.find_next_row(1, 2, false, false), Some(2));
//         assert_eq!(sheet.find_next_row(1, 2, true, false), Some(0));

//         sheet.set_cell_value(Pos { x: 2, y: 2 }, CellValue::Text(String::from("test")));
//         sheet.set_cell_value(Pos { x: 2, y: 3 }, CellValue::Text(String::from("test")));

//         assert_eq!(sheet.find_next_row(1, 2, false, false), Some(4));
//         assert_eq!(sheet.find_next_row(2, 2, false, false), Some(4));
//         assert_eq!(sheet.find_next_row(3, 2, true, false), Some(0));
//     }

//     fn chart_5x5_dt() -> DataTable {
//         let mut dt = DataTable::new(
//             DataTableKind::CodeRun(CodeRun::default()),
//             "test",
//             Value::Single(CellValue::Html("html".to_string())),
//             false,
//             Some(true),
//             Some(true),
//             // make the chart take up 5x5 cells
//             Some((5, 5)),
//         );
//         dt.show_name = Some(false);
//         dt
//     }

//     #[test]
//     fn find_next_column_with_chart() {
//         let mut sheet = Sheet::test();
//         let dt = chart_5x5_dt();
//         sheet.set_cell_value(
//             Pos { x: 5, y: 5 },
//             CellValue::Code(CodeCellValue::new(
//                 CodeCellLanguage::Javascript,
//                 "".to_string(),
//             )),
//         );
//         sheet.set_data_table(Pos { x: 5, y: 5 }, Some(dt));
//         let a1_context = sheet.expensive_make_a1_context();
//         sheet.recalculate_bounds(&a1_context);

//         // should find the anchor of the table
//         assert_eq!(sheet.find_next_column(1, 5, false, true), Some(5));

//         // ensure we're not finding the table if we're in the wrong row
//         assert_eq!(sheet.find_next_column(1, 1, false, true), None);

//         // should find the chart-sized table
//         assert_eq!(sheet.find_next_column(1, 7, false, true), Some(5));

//         // should not find the table if we're already inside the table
//         assert_eq!(sheet.find_next_column(6, 5, false, true), None);
//     }

//     #[test]
//     fn find_next_column_with_two_tables() {
//         let mut sheet = Sheet::test();
//         sheet.set_cell_value(
//             Pos { x: 5, y: 5 },
//             CellValue::Code(CodeCellValue::new(
//                 CodeCellLanguage::Javascript,
//                 "".to_string(),
//             )),
//         );
//         sheet.set_data_table(Pos { x: 5, y: 5 }, Some(chart_5x5_dt()));
//         sheet.set_cell_value(
//             Pos { x: 20, y: 5 },
//             CellValue::Code(CodeCellValue::new(
//                 CodeCellLanguage::Javascript,
//                 "".to_string(),
//             )),
//         );
//         sheet.set_data_table(Pos { x: 20, y: 5 }, Some(chart_5x5_dt()));
//         let a1_context = sheet.expensive_make_a1_context();
//         sheet.recalculate_bounds(&a1_context);

//         // should find the first table
//         assert_eq!(sheet.find_next_column(1, 6, false, true), Some(5));

//         // should find the second table even though we're inside the first
//         assert_eq!(sheet.find_next_column(6, 6, false, true), Some(20));

//         // should find the second table moving backwards
//         assert_eq!(sheet.find_next_column(30, 6, true, true), Some(24));

//         // should find the first table moving backwards even though we're inside
//         // the second table
//         assert_eq!(sheet.find_next_column(23, 6, true, true), Some(9));
//     }

//     #[test]
//     fn find_next_row_with_table() {
//         let mut sheet = Sheet::test();
//         let dt = chart_5x5_dt();
//         sheet.set_cell_value(
//             Pos { x: 5, y: 5 },
//             CellValue::Code(CodeCellValue::new(
//                 CodeCellLanguage::Javascript,
//                 "".to_string(),
//             )),
//         );
//         sheet.set_data_table(Pos { x: 5, y: 5 }, Some(dt));
//         let a1_context = sheet.expensive_make_a1_context();
//         sheet.recalculate_bounds(&a1_context);

//         // should find the anchor of the table
//         assert_eq!(sheet.find_next_row(1, 5, false, true), Some(5));

//         // ensure we're not finding the table if we're in the wrong column
//         assert_eq!(sheet.find_next_column(1, 1, false, true), None);

//         // should find the chart-sized table
//         assert_eq!(sheet.find_next_row(1, 7, false, true), Some(5));

//         // should not find the table if we're already inside the table
//         assert_eq!(sheet.find_next_row(6, 6, false, true), None);
//     }

//     #[test]
//     fn find_next_row_with_two_tables() {
//         let mut sheet = Sheet::test();
//         sheet.set_cell_value(
//             Pos { x: 5, y: 5 },
//             CellValue::Code(CodeCellValue::new(
//                 CodeCellLanguage::Javascript,
//                 "".to_string(),
//             )),
//         );
//         sheet.set_data_table(Pos { x: 5, y: 5 }, Some(chart_5x5_dt()));
//         sheet.set_cell_value(
//             Pos { x: 5, y: 20 },
//             CellValue::Code(CodeCellValue::new(
//                 CodeCellLanguage::Javascript,
//                 "".to_string(),
//             )),
//         );
//         sheet.set_data_table(Pos { x: 5, y: 20 }, Some(chart_5x5_dt()));
//         let a1_context = sheet.expensive_make_a1_context();
//         sheet.recalculate_bounds(&a1_context);

//         // should find the first table
//         assert_eq!(sheet.find_next_row(1, 6, false, true), Some(5));

//         // should find the second table even though we're inside the first
//         assert_eq!(sheet.find_next_row(6, 6, false, true), Some(20));

//         // should find the second table moving backwards
//         assert_eq!(sheet.find_next_row(30, 6, true, true), Some(25));

//         // should find the first table moving backwards even though we're inside
//         // the second table
//         assert_eq!(sheet.find_next_row(23, 6, true, true), Some(10));
//     }
// }
