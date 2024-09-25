use super::Sheet;
use crate::{CellValue, Pos, SheetPos, Value};

use serde::{Deserialize, Serialize};

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
                    let format = self.format_cell(pos.x, pos.y, true);
                    let display = cell_value.to_number_display(
                        format.numeric_format,
                        format.numeric_decimals,
                        format.numeric_commas,
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
                    for y in 0..array.size().h.get() {
                        for x in 0..array.size().w.get() {
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
                                results.push(SheetPos {
                                    x: pos.x + x as i64,
                                    y: pos.y + y as i64,
                                    sheet_id: self.id,
                                });
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
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use chrono::Utc;

    use crate::{
        controller::GridController,
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
        Array, CodeCellValue,
    };

    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
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
    #[parallel]
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
    #[parallel]
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
    #[parallel]
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
    #[parallel]
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
    #[parallel]
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
                x: -10,
                y: -11,
                sheet_id,
            },
            "10.123%".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let results = sheet.search(&"123".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
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
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search(
            &"0.10123".into(),
            &SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
    }

    #[test]
    #[parallel]
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
            formatted_code_string: None,
            error: None,
            std_out: None,
            std_err: None,
            cells_accessed: HashSet::new(),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable {
            kind: DataTableKind::CodeRun(code_run),
            value: Value::Single("world".into()),
            spill_error: false,
            last_modified: Utc::now(),
        };
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
    #[parallel]
    fn search_within_code_runs() {
        let mut sheet = Sheet::test();
        let code_run = CodeRun {
            formatted_code_string: None,
            error: None,
            std_out: None,
            std_err: None,
            cells_accessed: HashSet::new(),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable {
            kind: DataTableKind::CodeRun(code_run),
            value: Value::Array(Array::from(vec![
                vec!["abc", "def", "ghi"],
                vec!["jkl", "mno", "pqr"],
            ])),
            spill_error: false,
            last_modified: Utc::now(),
        };
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
}
