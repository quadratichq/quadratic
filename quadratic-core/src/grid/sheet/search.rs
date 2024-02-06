use crate::{
    grid::{CodeRunResult, Column},
    CellValue, Pos, SheetPos, Value,
};

use super::Sheet;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SearchOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    case_sensitive: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    whole_cell: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    all_sheets: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    search_code: Option<bool>,
}

impl Default for SearchOptions {
    fn default() -> Self {
        SearchOptions {
            case_sensitive: None,
            whole_cell: None,
            all_sheets: None,
            search_code: None,
        }
    }
}

impl Sheet {
    /// Compares a CellValue to a query.
    /// Note: Column and y are necessary to compare display value for CellValue::Number (regrettably).
    ///
    /// Returns true if the cell value matches the query.
    fn compare_cell_value(
        &self,
        cell_value: &CellValue,
        query: &String,
        column: Option<&Column>,
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
                // first test against unformatted number
                if n.to_string() == *query || (!whole_cell && n.to_string().contains(query)) {
                    true
                } else {
                    // test against any formatting applied to the number
                    if let Some(column) = column.map_or(self.get_column(pos.x), |c| Some(c)) {
                        // compare the number using its display value (eg, $ or % or commas)
                        let numeric_format = column.numeric_format.get(pos.y);
                        let numeric_decimals = column.numeric_decimals.get(pos.y);
                        let numeric_commas = column.numeric_commas.get(pos.y);
                        let display =
                            cell_value.to_display(numeric_format, numeric_decimals, numeric_commas);
                        display == *query || (!whole_cell && display.contains(query))
                    } else {
                        false
                    }
                }
            }
            CellValue::Logical(b) => {
                let query = query.to_lowercase();
                (*b == true && query == "true") || (*b == false && query == "false")
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
                        Some(column),
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

    fn search_code_runs(
        &self,
        query: &String,
        case_sensitive: bool,
        whole_cell: bool,
    ) -> Vec<SheetPos> {
        let mut results = vec![];
        self.code_runs
            .iter()
            .for_each(|(pos, code_run)| match &code_run.result {
                CodeRunResult::Ok(value) => match value {
                    Value::Single(v) => {
                        if self.compare_cell_value(
                            &CellValue::from(v.clone()),
                            &query,
                            None,
                            *pos,
                            case_sensitive,
                            whole_cell,
                            false, // code_runs can never have code within them (although that would be cool if they did ;)
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
                                    &query,
                                    None,
                                    Pos {
                                        x: pos.x + x as i64,
                                        y: pos.y + y as i64,
                                    },
                                    case_sensitive,
                                    whole_cell,
                                    false, // code_runs can never have code within them (although that would be cool if they did ;)
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
                },
                CodeRunResult::Err(_) => (),
            });
        results
    }

    /// Searches the Sheet for a match to the query string.
    /// Returns the resulting SheetPos sorted by x and then y.
    ///
    /// Returns `Vec<SheetPos>` for all cells that match.
    pub fn search(&self, query: String, options: Option<SearchOptions>) -> Vec<SheetPos> {
        let options = options.unwrap_or_default();
        let case_sensitive = options.case_sensitive.unwrap_or(false);
        let query = if case_sensitive {
            query
        } else {
            query.to_lowercase()
        };
        let whole_cell = options.whole_cell.unwrap_or(false);
        let search_code = options.search_code.unwrap_or(false);
        let mut results = self.search_cell_values(&query, case_sensitive, whole_cell, search_code);
        results.extend(self.search_code_runs(&query, case_sensitive, whole_cell));
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
    use crate::controller::GridController;

    use super::*;

    #[test]
    fn simple_search() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_cell_value(Pos { x: -10, y: -10 }, CellValue::Text("hello".into()));
        let results = sheet.search("hello".into(), None);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -10),);
        assert_eq!(results[1], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search("goodbye".into(), None);
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn case_sensitive_search() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_cell_value(Pos { x: -10, y: -11 }, CellValue::Text("HELLO".into()));
        let results = sheet.search(
            "hello".into(),
            Some(SearchOptions {
                case_sensitive: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            "HELLO".into(),
            Some(SearchOptions {
                case_sensitive: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search("HELLO".into(), None);
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
            "hello".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            "hello".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            "hello".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            "hello".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            }),
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
            "hello".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 0);

        let results = sheet.search(
            "HELLO".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 0);

        let results = sheet.search(
            "hello world".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            "HELLO WORLD".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn search_numbers() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 4, y: 5 }, CellValue::Number(123.into()));
        sheet.set_cell_value(Pos { x: -10, y: -11 }, CellValue::Number(1234.into()));
        let results = sheet.search("123".into(), None);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
        assert_eq!(results[1], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search("1234".into(), None);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search("1234".into(), None);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search("1234".into(), None);
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
                x: -10,
                y: -11,
                sheet_id,
            },
            "10.123%".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let results = sheet.search("123".into(), None);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
        assert_eq!(results[1], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search("$5,123".into(), None);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            "5123".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, 4, 5));

        let results = sheet.search(
            "123".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 0);

        let results = sheet.search(
            "10.123%".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));

        let results = sheet.search(
            "0.10123".into(),
            Some(SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            }),
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], SheetPos::new(sheet.id, -10, -11));
    }
}
