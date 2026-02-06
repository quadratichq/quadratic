use super::Sheet;
use crate::{CellValue, Pos, Value, grid::js_types::JsSheetPosText};

use regex::Regex;
use serde::{Deserialize, Serialize};

const MAX_NEIGHBOR_TEXT: usize = 1000;

fn regex_matches(regex: &Regex, text: &str, whole_cell: bool) -> bool {
    if whole_cell {
        regex.find(text).is_some_and(|m| m.as_str() == text)
    } else {
        regex.is_match(text)
    }
}

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub regex: Option<bool>,
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
        regex: Option<&Regex>,
    ) -> Option<String> {
        match cell_value {
            CellValue::Text(text) => {
                let matches = if let Some(regex) = regex {
                    regex_matches(regex, text, whole_cell)
                } else {
                    (case_sensitive && text == query)
                        || (!case_sensitive && text.to_lowercase() == *query)
                        || (!whole_cell
                            && ((!case_sensitive
                                && text.to_lowercase().contains(&query.to_lowercase()))
                                || (case_sensitive && text.contains(query))))
                };
                matches.then(|| text.to_string())
            }
            CellValue::Number(n) => {
                let display = self.rendered_value(pos).unwrap_or_else(|| n.to_string());
                let raw = n.to_string();

                let matches = if let Some(regex) = regex {
                    regex_matches(regex, &raw, whole_cell)
                        || regex_matches(regex, &display, whole_cell)
                } else {
                    raw == *query
                        || display == *query
                        || (!whole_cell && (raw.contains(query) || display.contains(query)))
                };
                matches.then(|| display)
            }
            CellValue::Logical(b) => {
                let text = if *b { "true" } else { "false" };
                let matches = if let Some(regex) = regex {
                    regex_matches(regex, text, false)
                } else {
                    let query = query.to_lowercase();
                    (*b && query == "true") || (!(*b) && query == "false")
                };
                matches.then(|| text.to_string())
            }
            _ => None,
        }
    }

    /// Searches the column.values for a match to the query string.
    fn search_cell_values(
        &self,
        query: &String,
        case_sensitive: bool,
        whole_cell: bool,
        regex: Option<&Regex>,
    ) -> Vec<JsSheetPosText> {
        self.columns
            .expensive_iter()
            .flat_map(|(x, column)| {
                column.values.iter().flat_map(|(y, cell_value)| {
                    self.compare_cell_value(
                        cell_value,
                        query,
                        Pos { x: *x, y: *y },
                        case_sensitive,
                        whole_cell,
                        regex,
                    )
                    .map(|text| JsSheetPosText {
                        sheet_id: self.id.to_string(),
                        x: *x,
                        y: *y,
                        text: Some(text),
                    })
                })
            })
            .collect::<Vec<_>>()
    }

    fn search_data_tables(
        &self,
        query: &String,
        case_sensitive: bool,
        whole_cell: bool,
        search_code: bool,
        regex: Option<&Regex>,
    ) -> Vec<JsSheetPosText> {
        let mut results = vec![];
        self.data_tables
            .expensive_iter()
            .for_each(|(data_table_pos, data_table)| {
                if search_code && let Some(code_run) = data_table.code_run() {
                    let code_matches = if let Some(regex) = regex {
                        regex.is_match(&code_run.code)
                    } else {
                        (case_sensitive && code_run.code.contains(query))
                            || (!case_sensitive && code_run.code.to_lowercase().contains(query))
                    };
                    if code_matches {
                        results.push(JsSheetPosText {
                            sheet_id: self.id.to_string(),
                            x: data_table_pos.x,
                            y: data_table_pos.y,
                            text: Some(code_run.code.to_string()),
                        });
                    }
                }

                // we can return early if the data table has a spill or error
                // (todo: maybe search the error as well?)
                if data_table.has_spill() || data_table.has_error() {
                    return;
                }

                match &data_table.value {
                    Value::Single(v) => {
                        if let Some(text) = self.compare_cell_value(
                            v,
                            query,
                            *data_table_pos,
                            case_sensitive,
                            whole_cell,
                            regex,
                        ) {
                            results.push(JsSheetPosText {
                                sheet_id: self.id.to_string(),
                                x: data_table_pos.x,
                                y: data_table_pos.y,
                                text: Some(text),
                            });
                        }
                    }
                    Value::Array(array) => {
                        let y_adjustment = data_table.y_adjustment(true);

                        let reverse_display_buffer = data_table.get_reverse_display_buffer();

                        for y in 0..array.size().h.get() {
                            let display_row = data_table
                                .get_display_index_from_reverse_display_buffer(
                                    y as u64,
                                    reverse_display_buffer.as_ref(),
                                );

                            for x in 0..array.size().w.get() {
                                let column_display = data_table.header_display(x as usize);
                                if !column_display {
                                    continue;
                                }

                                let cell_value = array.get(x, y).unwrap();
                                if let Some(text) = self.compare_cell_value(
                                    cell_value,
                                    query,
                                    Pos {
                                        x: data_table_pos.x + x as i64,
                                        y: data_table_pos.y + y as i64,
                                    },
                                    case_sensitive,
                                    whole_cell,
                                    regex,
                                ) {
                                    let y = data_table_pos.y + y_adjustment + display_row as i64;
                                    if y >= data_table_pos.y {
                                        results.push(JsSheetPosText {
                                            sheet_id: self.id.to_string(),
                                            x: data_table_pos.x + x as i64,
                                            y,
                                            text: Some(text),
                                        });
                                    }
                                }
                            }
                        }
                    }
                    Value::Tuple(_) | Value::Lambda(_) => {} // Tuples and lambdas are not spilled onto the grid
                }
            });
        results
    }

    /// Searches the Sheet for a match to the query string.
    /// Returns the resulting SheetPos sorted by x and then y.
    ///
    /// Returns `Vec<SheetPos>` for all cells that match.
    pub fn search(&self, query: &String, options: &SearchOptions) -> Vec<JsSheetPosText> {
        let case_sensitive = options.case_sensitive.unwrap_or(false);
        let is_regex = options.regex.unwrap_or(false);
        let query = if case_sensitive || is_regex {
            query.to_owned()
        } else {
            query.to_lowercase()
        };
        let whole_cell = options.whole_cell.unwrap_or(false);
        let search_code = options.search_code.unwrap_or(false);

        // Build regex if enabled
        let regex = if is_regex {
            let pattern = if case_sensitive {
                query.clone()
            } else {
                format!("(?i){}", query)
            };
            Regex::new(&pattern).ok()
        } else {
            None
        };

        let mut results =
            self.search_cell_values(&query, case_sensitive, whole_cell, regex.as_ref());
        results.extend(self.search_data_tables(
            &query,
            case_sensitive,
            whole_cell,
            search_code,
            regex.as_ref(),
        ));
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
        if let Some((data_table_pos, data_table)) = self.data_table_that_contains(pos) {
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
        } else if let Some(column) = self.get_column(pos.x) {
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
        Array, SheetPos,
        controller::{GridController, user_actions::import::tests::simple_csv_at},
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
    };

    #[test]
    fn simple_search() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_value(Pos { x: -10, y: -10 }, CellValue::Text("hello".into()));
        let results = sheet.search(&"hello".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: -10,
                y: -10,
                text: Some("hello".to_string()),
            }
        );
        assert_eq!(
            results[1],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello".to_string()),
            }
        );

        let results = sheet.search(&"goodbye".into(), &SearchOptions::default());
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn case_sensitive_search() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_value(Pos { x: -10, y: -11 }, CellValue::Text("HELLO".into()));
        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello".to_string()),
            }
        );

        let results = sheet.search(
            &"HELLO".into(),
            &SearchOptions {
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: -10,
                y: -11,
                text: Some("HELLO".to_string()),
            }
        );

        let results = sheet.search(&"HELLO".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: -10,
                y: -11,
                text: Some("HELLO".to_string()),
            }
        );
        assert_eq!(
            results[1],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello".to_string()),
            }
        );
    }

    #[test]
    fn whole_cell_search() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 4, y: 5 }, CellValue::Text("hello".into()));
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("hello world".into()));
        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello".to_string()),
            }
        );

        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello".to_string()),
            }
        );

        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello".to_string()),
            }
        );

        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello".to_string()),
            }
        );
    }

    #[test]
    fn whole_cell_search_case_sensitive() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 4, y: 5 }, CellValue::Text("hello world".into()));
        sheet.set_value(
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
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("hello world".to_string()),
            }
        );

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
        sheet.set_value(Pos { x: 4, y: 5 }, CellValue::Number(123.into()));
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Number(1234.into()));
        let results = sheet.search(&"123".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 1,
                text: Some("1234".to_string()),
            }
        );
        assert_eq!(
            results[1],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("123".to_string()),
            }
        );

        let results = sheet.search(&"1234".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 1,
                text: Some("1234".to_string()),
            }
        );

        let results = sheet.search(&"1234".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 1,
                text: Some("1234".to_string()),
            }
        );

        let results = sheet.search(&"1234".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 1,
                text: Some("1234".to_string()),
            }
        );
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
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "10.123%".to_string(),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let results = sheet.search(&"123".into(), &SearchOptions::default());
        assert_eq!(results.len(), 2);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 1,
                text: Some("10.123%".to_string()),
            }
        );
        assert_eq!(
            results[1],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("$5,123.00".to_string()),
            }
        );

        let results = sheet.search(&"$5,123".into(), &SearchOptions::default());
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("$5,123.00".to_string()),
            }
        );

        let results = sheet.search(
            &"5123".into(),
            &SearchOptions {
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 4,
                y: 5,
                text: Some("$5,123.00".to_string()),
            }
        );

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
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 1,
                text: Some("10.123%".to_string()),
            }
        );

        let results = sheet.search(
            &"0.10123".into(),
            &SearchOptions {
                whole_cell: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 1,
                text: Some("10.123%".to_string()),
            }
        );
    }

    #[test]
    fn search_code_runs() {
        let mut sheet = Sheet::test();
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "hello".into(),
            formula_ast: None,
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
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                text: Some("hello".to_string()),
            }
        );

        let results = sheet.search(
            &"world".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                text: Some("world".to_string()),
            }
        );
    }

    #[test]
    fn search_within_code_runs() {
        let mut sheet = Sheet::test();
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "".into(),
            formula_ast: None,
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
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                text: Some("abc".to_string()),
            }
        );

        let results = sheet.search(
            &"def".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 2,
                y: 2,
                text: Some("def".to_string()),
            }
        );

        let results = sheet.search(
            &"pqr".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet.id.to_string(),
                x: 3,
                y: 3,
                text: Some("pqr".to_string()),
            }
        );
    }

    #[test]
    fn neighbor_text_single_column() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_value(Pos { x: 1, y: 3 }, CellValue::Text("C".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 2 });
        assert_eq!(neighbors, vec!["A".to_string(), "C".to_string()]);
    }

    #[test]
    fn neighbor_text_with_gaps() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_value(Pos { x: 1, y: 5 }, CellValue::Text("C".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 3 });
        assert!(neighbors.iter().any(|t| t == &"A".to_string()));
        assert!(neighbors.iter().any(|t| t == &"B".to_string()));
    }

    #[test]
    fn neighbor_text_no_neighbors() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 1 });
        assert!(neighbors.is_empty());
    }

    #[test]
    fn neighbor_text_deduplication() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 0 }, CellValue::Text("B".into()));
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_value(Pos { x: 1, y: 4 }, CellValue::Text("B".into()));

        let neighbors = sheet.neighbor_text(Pos { x: 1, y: 3 });
        assert_eq!(neighbors, vec!["A".to_string(), "B".to_string()]);
    }

    #[test]
    fn neighbor_text_multiple_columns() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("A".into()));
        sheet.set_value(Pos { x: 1, y: 2 }, CellValue::Text("B".into()));
        sheet.set_value(Pos { x: 2, y: 2 }, CellValue::Text("C".into()));
        sheet.set_value(Pos { x: 1, y: 3 }, CellValue::Text("D".into()));

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
            sheet.set_value(Pos { x: 1, y: y as i64 }, CellValue::Text(y.to_string()));
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
        sheet.set_value(pos![E15], CellValue::Text("hello".into()));

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
        sheet
            .modify_data_table_at(&pos, |dt| {
                let column_headers = dt.column_headers.as_mut().unwrap();
                column_headers[0].display = false;
                Ok(())
            })
            .unwrap();

        let neighbors = sheet.neighbor_text(pos![E12]);
        assert_eq!(neighbors, vec!["MA", "MO", "NH", "NJ", "OH", "region"]);
    }

    #[test]
    fn test_search_data_tables() {
        let (gc, sheet_id, _, _) = simple_csv_at(pos!(E2));

        print_first_sheet!(&gc);

        let sheet = gc.sheet(sheet_id);

        let results = sheet.search(
            &"MO".into(),
            &SearchOptions {
                search_code: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            JsSheetPosText {
                sheet_id: sheet_id.to_string(),
                x: 6,
                y: 9,
                text: Some("MO".to_string()),
            }
        );
    }

    #[test]
    fn regex_search_basic() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("hello".into()));
        sheet.set_value(Pos { x: 2, y: 2 }, CellValue::Text("world".into()));
        sheet.set_value(Pos { x: 3, y: 3 }, CellValue::Text("hello world".into()));

        // Search for words starting with 'h'
        let results = sheet.search(
            &"^h".into(),
            &SearchOptions {
                regex: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|r| r.text == Some("hello".to_string())));
        assert!(
            results
                .iter()
                .any(|r| r.text == Some("hello world".to_string()))
        );
    }

    #[test]
    fn regex_search_digits() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("abc123".into()));
        sheet.set_value(Pos { x: 2, y: 2 }, CellValue::Text("def456".into()));
        sheet.set_value(Pos { x: 3, y: 3 }, CellValue::Text("nodigits".into()));

        // Search for cells containing digits
        let results = sheet.search(
            &r"\d+".into(),
            &SearchOptions {
                regex: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|r| r.text == Some("abc123".to_string())));
        assert!(results.iter().any(|r| r.text == Some("def456".to_string())));
    }

    #[test]
    fn regex_search_case_insensitive() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("HELLO".into()));
        sheet.set_value(Pos { x: 2, y: 2 }, CellValue::Text("hello".into()));
        sheet.set_value(Pos { x: 3, y: 3 }, CellValue::Text("HeLLo".into()));

        // Case insensitive regex (default)
        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                regex: Some(true),
                case_sensitive: Some(false),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 3);

        // Case sensitive regex
        let results = sheet.search(
            &"hello".into(),
            &SearchOptions {
                regex: Some(true),
                case_sensitive: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text, Some("hello".to_string()));
    }

    #[test]
    fn regex_search_whole_cell() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("test".into()));
        sheet.set_value(Pos { x: 2, y: 2 }, CellValue::Text("testing".into()));
        sheet.set_value(Pos { x: 3, y: 3 }, CellValue::Text("test123".into()));

        // Regex with whole_cell - should only match exact "test"
        let results = sheet.search(
            &"^test$".into(),
            &SearchOptions {
                regex: Some(true),
                whole_cell: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text, Some("test".to_string()));

        // Regex without whole_cell - should match partial
        let results = sheet.search(
            &"test".into(),
            &SearchOptions {
                regex: Some(true),
                whole_cell: Some(false),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn regex_search_alternation() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("apple".into()));
        sheet.set_value(Pos { x: 2, y: 2 }, CellValue::Text("banana".into()));
        sheet.set_value(Pos { x: 3, y: 3 }, CellValue::Text("cherry".into()));

        // Search for apple or cherry
        let results = sheet.search(
            &"apple|cherry".into(),
            &SearchOptions {
                regex: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|r| r.text == Some("apple".to_string())));
        assert!(results.iter().any(|r| r.text == Some("cherry".to_string())));
    }

    #[test]
    fn regex_search_invalid_pattern() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Text("test".into()));

        // Invalid regex pattern should return no results (regex fails to compile)
        let results = sheet.search(
            &"[invalid".into(),
            &SearchOptions {
                regex: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn regex_search_numbers() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Number(123.into()));
        sheet.set_value(Pos { x: 2, y: 2 }, CellValue::Number(456.into()));
        sheet.set_value(Pos { x: 3, y: 3 }, CellValue::Number(789.into()));

        // Search for numbers containing "2" or "5"
        let results = sheet.search(
            &"[25]".into(),
            &SearchOptions {
                regex: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(results.len(), 2);
    }
}
