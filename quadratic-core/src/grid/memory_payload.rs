use serde::{Deserialize, Serialize};

#[cfg(feature = "js")]
use ts_rs::TS;

use super::bounds::GridBounds;
use super::{CodeCellLanguage, DataTableKind};
use crate::controller::GridController;
use crate::{CellValue, Pos};

/// Top-level payload extracted from a GridController for AI memory summarization.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct MemoryPayload {
    pub sheets: Vec<SheetMemoryPayload>,
    pub code_cells: Vec<CodeCellMemoryPayload>,
    pub sheet_tables: Vec<SheetTableMemoryPayload>,
}

/// Summary of a single sheet's structure for memory extraction.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct SheetMemoryPayload {
    pub name: String,
    pub bounds: Option<String>,
    pub data_tables: Vec<DataTableMemoryPayload>,
    pub code_tables: Vec<CodeTableMemoryPayload>,
    pub connections: Vec<ConnectionTableMemoryPayload>,
    pub charts: Vec<ChartMemoryPayload>,
}

/// Summary of an imported data table (CSV, Excel, etc.).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct DataTableMemoryPayload {
    pub name: String,
    pub columns: Vec<String>,
    pub bounds: String,
}

/// Summary of a code cell that produces a table output.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct CodeTableMemoryPayload {
    pub name: String,
    pub language: String,
    pub columns: Vec<String>,
    pub bounds: String,
    pub code: String,
}

/// Summary of a connection table (SQL query result).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct ConnectionTableMemoryPayload {
    pub name: String,
    pub connection_kind: String,
    pub columns: Vec<String>,
    pub bounds: String,
    pub code: String,
}

/// Summary of a chart code cell.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct ChartMemoryPayload {
    pub name: String,
    pub language: String,
    pub bounds: String,
    pub code: String,
}

/// Summary of an individual code cell (Python, JS, Formula, Connection).
/// These are the main entities that get individual AI summaries.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct CodeCellMemoryPayload {
    pub sheet_name: String,
    pub position: String,
    pub name: String,
    pub language: String,
    pub code: String,
    pub output_shape: Option<String>,
    pub has_error: bool,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
}

/// Summary of a contiguous region of cell data detected on a sheet (not a DataTable).
/// These are inline tabular regions where users typed or pasted data directly.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(TS))]
pub struct SheetTableMemoryPayload {
    pub sheet_name: String,
    pub bounds: String,
    pub columns: Vec<String>,
    pub rows: u32,
    pub cols: u32,
}

impl GridController {
    /// Extracts a MemoryPayload from the current grid state for AI summarization.
    pub fn extract_memory_payload(&self) -> MemoryPayload {
        let mut sheets = Vec::new();
        let mut code_cells = Vec::new();
        let mut sheet_tables = Vec::new();

        for sheet in self.grid().sheets().values() {
            let mut sheet_payload = SheetMemoryPayload {
                name: sheet.name.clone(),
                bounds: None,
                data_tables: Vec::new(),
                code_tables: Vec::new(),
                connections: Vec::new(),
                charts: Vec::new(),
            };

            let sheet_bounds = sheet.bounds(false);
            if let GridBounds::NonEmpty(rect) = sheet_bounds {
                sheet_payload.bounds = Some(rect.a1_string());
            }

            for (pos, table) in sheet.data_tables.expensive_iter() {
                if table.is_single_value() {
                    continue;
                }

                let bounds = table.output_rect(pos.to_owned(), false);
                let bounds_str = bounds.a1_string();

                if table.is_html_or_image() {
                    if let Some(code_run) = table.code_run() {
                        let lang_str = language_to_string(&code_run.language);
                        sheet_payload.charts.push(ChartMemoryPayload {
                            name: table.name().to_string(),
                            language: lang_str.clone(),
                            bounds: bounds_str.clone(),
                            code: code_run.code.clone(),
                        });
                        code_cells.push(CodeCellMemoryPayload {
                            sheet_name: sheet.name.clone(),
                            position: pos.a1_string(),
                            name: table.name().to_string(),
                            language: lang_str,
                            code: code_run.code.clone(),
                            output_shape: Some("chart".to_string()),
                            has_error: code_run.error.is_some(),
                            std_out: code_run.std_out.clone(),
                            std_err: code_run.std_err.clone(),
                        });
                    }
                    continue;
                }

                let columns = table.columns_map(true);
                let output_size = table.output_size();
                let output_shape = format!(
                    "{} rows x {} cols",
                    output_size.h.get(),
                    output_size.w.get()
                );

                match &table.kind {
                    DataTableKind::CodeRun(code_run) => {
                        let lang_str = language_to_string(&code_run.language);

                        if let CodeCellLanguage::Connection { kind, .. } = &code_run.language {
                            sheet_payload
                                .connections
                                .push(ConnectionTableMemoryPayload {
                                    name: table.name().to_string(),
                                    connection_kind: kind.to_string(),
                                    columns: columns.clone(),
                                    bounds: bounds_str.clone(),
                                    code: code_run.code.clone(),
                                });
                        } else {
                            sheet_payload.code_tables.push(CodeTableMemoryPayload {
                                name: table.name().to_string(),
                                language: lang_str.clone(),
                                columns: columns.clone(),
                                bounds: bounds_str.clone(),
                                code: code_run.code.clone(),
                            });
                        }

                        code_cells.push(CodeCellMemoryPayload {
                            sheet_name: sheet.name.clone(),
                            position: pos.a1_string(),
                            name: table.name().to_string(),
                            language: lang_str,
                            code: code_run.code.clone(),
                            output_shape: Some(output_shape),
                            has_error: code_run.error.is_some(),
                            std_out: code_run.std_out.clone(),
                            std_err: code_run.std_err.clone(),
                        });
                    }
                    DataTableKind::Import(_) => {
                        sheet_payload.data_tables.push(DataTableMemoryPayload {
                            name: table.name().to_string(),
                            columns,
                            bounds: bounds_str,
                        });
                    }
                }
            }

            // Detect inline tabular regions (contiguous cell data, not DataTables)
            if let GridBounds::NonEmpty(data_rect) = sheet.bounds(true) {
                let rects = sheet.find_tabular_data_rects_in_selection_rects(vec![data_rect]);
                for rect in rects {
                    let width = rect.width() as u32;
                    let height = rect.height() as u32;

                    // Skip trivially small regions
                    if width < 2 || height < 2 {
                        continue;
                    }

                    // Read the first row as potential column headers
                    let columns: Vec<String> = (rect.min.x..=rect.max.x)
                        .map(|x| {
                            sheet
                                .display_value(Pos { x, y: rect.min.y })
                                .map(|v| match v {
                                    CellValue::Blank => String::new(),
                                    other => other.to_string(),
                                })
                                .unwrap_or_default()
                        })
                        .collect();

                    sheet_tables.push(SheetTableMemoryPayload {
                        sheet_name: sheet.name.clone(),
                        bounds: rect.a1_string(),
                        columns,
                        rows: height,
                        cols: width,
                    });
                }
            }

            sheets.push(sheet_payload);
        }

        MemoryPayload {
            sheets,
            code_cells,
            sheet_tables,
        }
    }
}

fn language_to_string(language: &CodeCellLanguage) -> String {
    match language {
        CodeCellLanguage::Python => "Python".to_string(),
        CodeCellLanguage::Javascript => "JavaScript".to_string(),
        CodeCellLanguage::Formula => "Formula".to_string(),
        CodeCellLanguage::Connection { kind, .. } => format!("Connection ({})", kind),
        CodeCellLanguage::Import => "Import".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        Array, Pos, Rect, Value,
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
        test_util::*,
    };

    #[test]
    fn test_extract_memory_payload_empty() {
        let gc = test_create_gc();
        let payload = gc.extract_memory_payload();
        assert_eq!(payload.sheets.len(), 1);
        assert!(payload.code_cells.is_empty());
        assert!(payload.sheet_tables.is_empty());
        assert!(payload.sheets[0].bounds.is_none());
    }

    #[test]
    fn test_extract_memory_payload_with_code_cell() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "import pandas as pd\ndf = pd.DataFrame({'a': [1,2,3]})".to_string(),
            formula_ast: None,
            std_out: Some("Done".to_string()),
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("DataFrame".to_string()),
            line_number: None,
            output_type: None,
        };

        let table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Python1",
            Value::Array(Array::from(vec![
                vec!["a".to_string()],
                vec!["1".to_string()],
                vec!["2".to_string()],
                vec!["3".to_string()],
            ])),
            true,
            Some(true),
            Some(true),
            None,
        );

        gc.sheet_mut(sheet_id)
            .set_data_table(Pos { x: 1, y: 1 }, Some(table));

        let payload = gc.extract_memory_payload();
        assert_eq!(payload.code_cells.len(), 1);
        assert_eq!(payload.code_cells[0].name, "Python1");
        assert_eq!(payload.code_cells[0].language, "Python");
        assert!(payload.code_cells[0].code.contains("pandas"));
        assert_eq!(payload.code_cells[0].std_out, Some("Done".to_string()));
        assert!(!payload.code_cells[0].has_error);

        assert_eq!(payload.sheets[0].code_tables.len(), 1);
        assert_eq!(payload.sheets[0].code_tables[0].name, "Python1");
    }

    #[test]
    fn test_extract_memory_payload_with_formula() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_formula(&mut gc, pos![sheet_id!A1], "{1,2,3;4,5,6}");

        let payload = gc.extract_memory_payload();
        assert_eq!(payload.code_cells.len(), 1);
        assert_eq!(payload.code_cells[0].language, "Formula");
        assert!(!payload.code_cells[0].has_error);
        assert!(payload.code_cells[0].output_shape.is_some());
    }

    /// Helper to create a GridController with inline cell data set directly on the sheet.
    fn gc_with_cell_values(
        rect: Rect,
        values: Vec<Vec<String>>,
    ) -> crate::controller::GridController {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_values(rect, Array::from(values));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);
        gc
    }

    #[test]
    fn test_extract_memory_payload_with_sheet_table() {
        let gc = gc_with_cell_values(
            Rect::new(1, 1, 3, 4),
            vec![
                vec!["Name".into(), "Age".into(), "City".into()],
                vec!["Alice".into(), "30".into(), "NYC".into()],
                vec!["Bob".into(), "25".into(), "LA".into()],
                vec!["Carol".into(), "35".into(), "SF".into()],
            ],
        );

        let payload = gc.extract_memory_payload();
        assert_eq!(payload.sheet_tables.len(), 1);
        assert_eq!(payload.sheet_tables[0].sheet_name, "Sheet1");
        assert_eq!(payload.sheet_tables[0].bounds, "A1:C4");
        assert_eq!(payload.sheet_tables[0].columns, vec!["Name", "Age", "City"]);
        assert_eq!(payload.sheet_tables[0].rows, 4);
        assert_eq!(payload.sheet_tables[0].cols, 3);
    }

    #[test]
    fn test_extract_memory_payload_skips_small_regions() {
        let gc = gc_with_cell_values(
            Rect::new(1, 1, 1, 3),
            vec![vec!["A".into()], vec!["B".into()], vec!["C".into()]],
        );

        let payload = gc.extract_memory_payload();
        assert!(payload.sheet_tables.is_empty());
    }
}
