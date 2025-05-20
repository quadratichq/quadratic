use super::Sheet;
use crate::{CellValue, Pos, SheetPos, Value};

use serde::{Deserialize, Serialize};

const MAX_NEIGHBOR_TEXT: usize = 1000;

#[derive(Default, Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SearchOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub case_sensitive: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub whole_cell: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_code: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sheet_id: Option<String>,
}

impl Sheet {
    /// Compares a CellValue to a query.
    /// Note: Column and y are necessary to compare display value for CellValue::Number (regrettably).
    ///
    /// Returns true if the cell value matches the query.
    #[allow(clippy::too_many_arguments)]
    fn compare_cell_value(
        &self,
        cell_value: &CellValue,
        query: &String,
        pos: Pos,
        case_sensitive: bool,
        whole_cell: bool,
        search_code: bool,
    ) -> bool {
        match cell_value {
            CellValue::Text(text) => {
                if (case_sensitive && text == query)
                    || (!case_sensitive && text.to_lowercase() == *query)
                {
                    true
                } else if !whole_cell {
                    (!case_sensitive && text.to_lowercase().contains(&query.to_lowercase()))
                        || (case_sensitive && text.contains(query))
                } else {
                    false
                }
            }
            CellValue::Number(n) => {
                if n.to_string() == *query || (!whole_cell && n.to_string().contains(query)) {
                    true
                } else {
                    let numeric_format = self.formats.numeric_format.get(pos);
                    let numeric_decimals = self.formats.numeric_decimals.get(pos);
                    let numeric_commas = self.formats.numeric_commas.get(pos);
                    let display = cell_value.to_number_display(
                        numeric_format,
                        numeric_decimals,
                        numeric_commas,
                    );
                    display == *query || (!whole_cell && display.contains(query))
                }
            }
            CellValue::Logical(b) => {
                let query = query.to_lowercase();
                (*b && query == "true") || (!(*b) && query == "false")
            }
            CellValue::Code(code) => {
                if search_code {
                    let code = &code.code;
                    (case_sensitive && code.contains(query))
                        || (!case_sensitive && code.to_lowercase().contains(query))
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    /// Searches the column.values for a match to the query string.
    fn search_cell_values(
        &self,
        query: &String,
        case_sensitive: bool,
        whole_cell: bool,
        search_code: bool,
    ) -> Vec<SheetPos> {
        self.columns
            .iter()
            .flat_map(|(x, column)| {
                column.values.iter().flat_map(|(y, cell_value)| {
                    if self.compare_cell_value(
                        cell_value,
                        query,
                        Pos { x: *x, y: *y },
                        case_sensitive,
                        whole_cell,
                        search_code,
                    ) {
                        Some(SheetPos {
                            x: *x,
                            y: *y,
                            sheet_id: self.id,
                        })
                    } else {
                        None
                    }
                })
            })
            .collect::<Vec<_>>()
    }

    fn search_data_tables(
        &self,
        query: &String,
        case_sensitive: bool,
        whole_cell: bool,
    ) -> Vec<SheetPos> {
        let mut results = vec![];
        self.data_tables
            .iter()
            .filter(|(_, data_table)| !data_table.spill_error && !data_table.has_error())
            .for_each(|(pos, data_table)| match &data_table.value {
                Value::Single(v) => {
                    if self.compare_cell_value(
                        v,
                        query,
                        *pos,
                        case_sensitive,
                        whole_cell,
                        false, // data_tables can never have code within them (although that would be cool if they did ;)
                    ) {
                        results.push(pos.to_sheet_pos(self.id));
                    }
                }
                Value::Array(array) => {
                    for x in 0..array.size().w.get() {
                        let column_display = data_table.header_display(x as usize);
                        if !column_display {
                            continue;
                        }
                        for y in 0..array.size().h.get() {
                            let cell_value = array.get(x, y).unwrap();
                            if self.compare_cell_value(
                                cell_value,
                                query,
                                Pos {
                                    x: pos.x + x as i64,
                                    y: pos.y + y as i64,
                                },
                                case_sensitive,
                                whole_cell,
                                false, // data_tables can never have code within them (although that would be cool if they did ;)
                            ) {
                                let y = pos.y
                                    + data_table.y_adjustment(true)
                                    + data_table.get_display_index_from_row_index(y as u64) as i64;
                                if y >= pos.y {
                                    results.push(SheetPos {
                                        x: pos.x + x as i64,
                                        y,
                                        sheet_id: self.id,
                                    });
                                }
                            }
                        }
                    }
                }
                Value::Tuple(_) => {} // Tuples are not spilled onto the grid);
            });
        results
    }

    /// Searches the Sheet for a match to the query string.
    /// Returns the resulting SheetPos sorted by x and then y.
    ///
    /// Returns `Vec<SheetPos>` for all cells that match.
    pub fn search(&self, query: &String, options: &SearchOptions) -> Vec<SheetPos> {
        let case_sensitive = options.case_sensitive.unwrap_or(false);
        let query = if case_sensitive {
            query.to_owned()
        } else {
            query.to_lowercase()
        };
        let whole_cell = options.whole_cell.unwrap_or(false);
        let search_code = options.search_code.unwrap_or(false);
        let mut results = self.search_cell_values(&query, case_sensitive, whole_cell, search_code);
        results.extend(self.search_data_tables(&query, case_sensitive, whole_cell));
        results.sort_by(|a, b| {
            let order = a.x.cmp(&b.x);
            if order == std::cmp::Ordering::Equal {
                a.y.cmp(&b.y)
            } else {
                order
            }
        });
        results
    }

    /// Returns a Vec<String> of all the neighboring text in the column. Search
    /// results limited to MAX_NEIGHBOR_TEXT.
    ///
    /// This is called only one time to return all neighboring values. If we
    /// move to readers, rust can handle the comparisons by passing in the
    /// current input value.
    pub fn neighbor_text(&self, pos: Pos) -> Vec<String> {
        let mut text = vec![];
        if let Ok(data_table_pos) = self.first_data_table_within(pos) {
            let Some(data_table) = self.data_tables.get(&data_table_pos) else {
                return text;
            };

            let Ok(display_column_index) = u32::try_from(pos.x - data_table_pos.x) else {
                return text;
            };

            // handle hidden columns
            let actual_column_index =
                data_table.get_column_index_from_display_index(display_column_index, true);

            let Ok(column) = data_table.get_column_sorted(actual_column_index as usize) else {
                return text;
            };

            let row_index = pos.y - data_table_pos.y - data_table.y_adjustment(true);
            if let Ok(row_index) = usize::try_from(row_index) {
                for cell in column.iter().skip(row_index + 1) {
                    if text.len() >= MAX_NEIGHBOR_TEXT {
                        break;
                    }
                    text.push(cell.to_string());
                }
                for cell in column.iter().take(row_index).rev() {
                    if text.len() >= MAX_NEIGHBOR_TEXT {
                        break;
                    }
                    text.push(cell.to_string());
                }
            }
        } else if let Some(column) = self.columns.get(&pos.x) {
            // walk forwards
            let mut y = pos.y + 1;
            while let Some(CellValue::Text(t)) = column.values.get(&y) {
                if text.len() >= MAX_NEIGHBOR_TEXT {
                    break;
                }
                text.push(t.clone());
                y += 1;
            }

            // walk backwards
            let mut y = pos.y - 1;
            while y >= 1 {
                if let Some(CellValue::Text(t)) = column.values.get(&y) {
                    if text.len() >= MAX_NEIGHBOR_TEXT {
                        break;
                    }
                    text.push(t.clone());
                    y -= 1;
                } else {
                    break;
                }
            }
        }
        text.sort();
        text.dedup();
        text
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        Array,
        controller::{GridController, user_actions::import::tests::simple_csv_at},
        grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind},
    };

    #[test]
    fn simple_search() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_cell_value(Pos { x: -10, y: -10 }, CellValue::Text("hello".into()));
        let results = sheet.search(&"hello".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -10),);
        assert_eq!(results[1], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(&"goodbye".into(), &SearchOptions::default());
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn case_sensitive_search() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_cell_value(Pos { x: -10, y: -11 }, CellValue::Text("HELLO".into()));
        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            &"HELLO".into(),
            &SearchOptions {
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search(&"HELLO".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
        assert_eq!(results[1], SheetPos::new(sheet.id, 4, 5));
    }

    #[test]
    fn whole_cell_search() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_cell_value(
            Pos { x: -10, y: -11 },
            CellValue::Text("hello world".into()),
        );
        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));
    }

    #[test]
    fn whole_cell_search_case_sensitive() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Text("hello world".into()));
        sheet.set_cell_value(
            Pos { x: -10, y: -11 },
            CellValue::Text("HELLO world".into()),
        );
        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 0);

        let results = sheet.search(
            &"HELLO".into(),
            &SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 0);

        let results = sheet.search(
            &"hello world".into(),
            &SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            &"HELLO WORLD".into(),
            &SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn search_numbers() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Number(123.into()));
        sheet.set_cell_value(Pos { x: -10, y: -11 }, CellValue::Number(1234.into()));
        let results = sheet.search(&"123".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
        assert_eq!(results[1], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(&"1234".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search(&"1234".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search(&"1234".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
    }

    #[test]
    fn search_display_numbers() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 4,
                y: 5,
                sheet_id,
            },
            "$5,123".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "10.123%".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let results = sheet.search(&"123".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, 1, 1));
        assert_eq!(results[1], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(&"$5,123".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            &"5123".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            &"123".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 0);

        let results = sheet.search(
            &"10.123%".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 1, 1));

        let results = sheet.search(
            &"0.10123".into(),
            &SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 1, 1));
    }

    #[test]
    fn search_code_runs() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(
            Pos { x: 1, y: 2 },
            CellValue::Code(CodeCellValue {
                code: "hello".into(),
                language: CodeCellLanguage::Python,
            }),
        );
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "hello".into(),
            error: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single("world".into()),
            false,
            false,
            Some(false),
            Some(false),
            None,
        );
        sheet.set_data_table(Pos { x: 1, y: 2 }, Some(data_table));

        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 1, 2));

        let results = sheet.search(
            &"world".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 1, 2));
    }

    #[test]
    fn search_within_code_runs() {
        let mut sheet = Sheet::test();
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "".into(),
            error: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::from(vec![
                vec!["abc", "def", "ghi"],
                vec!["jkl", "mno", "pqr"],
            ])),
            false,
            false,
            Some(false),
            Some(false),
            None,
        );
        sheet.set_data_table(Pos { x: 1, y: 2 }, Some(data_table));

        let results = sheet.search(
            &"abc".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 1, 2));

        let results = sheet.search(
            &"def".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 2, 2));

        let results = sheet.search(
            &"pqr".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 3, 3));
    }

    #[test]
    fn neighbor_text_single_column() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_cell_value(Pos { x: 1, y: 3 }, CellValue::Text("C".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 2 });
        assert_eq!(neighbors, vec!["A".to_string(), "C".to_string()]);
    }

    #[test]
    fn neighbor_text_with_gaps() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_cell_value(Pos { x: 1, y: 5 }, CellValue::Text("C".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 3 });
        assert!(neighbors.iter().any(|t| t == &"A".to_string()));
        assert!(neighbors.iter().any(|t| t == &"B".to_string()));
    }

    #[test]
    fn neighbor_text_no_neighbors() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 1 });
        assert!(neighbors.is_empty());
    }

    #[test]
    fn neighbor_text_deduplication() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 0 }, CellValue::Text("B".into()));
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_cell_value(Pos { x: 1, y: 4 }, CellValue::Text("B".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 3 });
        assert_eq!(neighbors, vec!["A".to_string(), "B".to_string()]);
    }

    #[test]
    fn neighbor_text_multiple_columns() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_cell_value(Pos { x: 2, y: 2 }, CellValue::Text("C".into()));
        sheet.set_cell_value(Pos { x: 1, y: 3 }, CellValue::Text("D".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 2 });
        assert_eq!(neighbors, vec!["A".to_string(), "D".to_string()]);
    }

    #[test]
    fn neighbor_text_empty_column() {
        let sheet = Sheet::test();
        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 1 });
        assert!(neighbors.is_empty());
    }

    #[test]
    fn max_neighbor_text() {
        let mut sheet = Sheet::test();
        for y in 0..MAX_NEIGHBOR_TEXT + 10 {
            sheet.set_cell_value(Pos { x: 1, y: y as i64 }, CellValue::Text(y.to_string()));
        }
        let neighbors = sheet.neighbor_text(Pos {
            x: 1,
            y: MAX_NEIGHBOR_TEXT as i64 / 2,
        });
        assert_eq!(neighbors.len(), MAX_NEIGHBOR_TEXT);
    }

    #[test]
    fn neighbor_text_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![E15], CellValue::Text("hello".into()));

        let neighbors = sheet.neighbor_text(pos![E12]);
        assert_eq!(
            neighbors,
            vec![
                "Concord",
                "Marlborough",
                "Northbridge",
                "Southborough",
                "Springfield",
                "Westborough",
                "city"
            ]
        );
        assert!(!neighbors.contains(&"hello".to_string()));

        // hide first column
        let data_table = sheet.data_table_mut(pos).unwrap();
        let column_headers = data_table.column_headers.as_mut().unwrap();
        column_headers[0].display = false;

        let neighbors = sheet.neighbor_text(pos![E12]);
        assert_eq!(neighbors, vec!["MA", "MO", "NH", "NJ", "OH", "region"]);
    }

    #[test]
    fn search_data_tables() {
        let (gc, sheet_id, _, _) = simple_csv_at(pos!(E2));

        let sheet = gc.sheet(sheet_id);

        let results = sheet.search(
            &"MO".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet_id, 6, 9));
    }
}
