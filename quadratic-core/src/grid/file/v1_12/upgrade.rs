//! Upgrade from v1_12 to v1_13 file format.
//!
//! The main change in v1_13 is that single-cell code cells (1x1 output, no table UI)
//! are stored as CellValue::Code in the columns rather than as DataTables.

use anyhow::Result;
use chrono::Utc;

use crate::grid::file::v1_12 as current;
use crate::grid::file::v1_13;

/// Determines if a DataTable should be converted to a CellValue::Code.
/// Returns true if the table has 1x1 output and no visible table UI.
fn is_single_cell_code(table: &current::DataTableSchema) -> bool {
    // Must be a CodeRun (not an Import)
    let current::DataTableKindSchema::CodeRun(code_run) = &table.kind else {
        return false;
    };

    // Must not have an error. Error detection is language-specific:
    // - Python/JS: errors set code_run.error (std_err may contain warnings, not just errors)
    // - Formulas: errors only set std_err (error is always None)
    if code_run.error.is_some() {
        return false;
    }
    // For formulas, std_err contains error messages
    if code_run.language == current::CodeCellLanguageSchema::Formula && code_run.std_err.is_some() {
        return false;
    }

    // Check if output is 1x1
    let is_1x1 = match &table.value {
        current::OutputValueSchema::Single(_) => true,
        current::OutputValueSchema::Array(arr) => arr.size.w == 1 && arr.size.h == 1,
    };
    if !is_1x1 {
        return false;
    }

    // Must not be blank (placeholder before execution)
    let is_blank = match &table.value {
        current::OutputValueSchema::Single(current::CellValueSchema::Blank) => true,
        current::OutputValueSchema::Array(arr) => {
            arr.values.is_empty() || matches!(arr.values[0], current::CellValueSchema::Blank)
        }
        _ => false,
    };
    if is_blank {
        return false;
    }

    // Must not be a chart (HTML/image) -- these need to stay as DataTables
    // so the rendering code can find them and use chart_output dimensions
    let is_html_or_image = match &table.value {
        current::OutputValueSchema::Single(
            current::CellValueSchema::Html(_) | current::CellValueSchema::Image(_),
        ) => true,
        _ => false,
    };
    if is_html_or_image {
        return false;
    }

    if table.chart_output.is_some() {
        return false;
    }

    // Check if table UI is hidden
    let no_name_ui = table.show_name != Some(true);
    let no_columns_ui = table.show_columns != Some(true);

    no_name_ui && no_columns_ui
}

/// Gets the single output value from an OutputValueSchema.
fn get_single_output(value: &current::OutputValueSchema) -> current::CellValueSchema {
    match value {
        current::OutputValueSchema::Single(v) => v.clone(),
        current::OutputValueSchema::Array(arr) => {
            if arr.values.is_empty() {
                current::CellValueSchema::Blank
            } else {
                arr.values[0].clone()
            }
        }
    }
}

/// Extracts the CodeRunSchema from a DataTableKindSchema.
fn extract_code_run(kind: &current::DataTableKindSchema) -> Option<current::CodeRunSchema> {
    match kind {
        current::DataTableKindSchema::CodeRun(code_run) => Some((**code_run).clone()),
        current::DataTableKindSchema::Import(_) => None,
    }
}

fn upgrade_cell_value(value: current::CellValueSchema) -> v1_13::CellValueSchema {
    match value {
        current::CellValueSchema::Blank => v1_13::CellValueSchema::Blank,
        current::CellValueSchema::Text(s) => v1_13::CellValueSchema::Text(s),
        current::CellValueSchema::Number(s) => v1_13::CellValueSchema::Number(s),
        current::CellValueSchema::Html(s) => v1_13::CellValueSchema::Html(s),
        current::CellValueSchema::Logical(b) => v1_13::CellValueSchema::Logical(b),
        current::CellValueSchema::Instant(s) => v1_13::CellValueSchema::Instant(s),
        current::CellValueSchema::Date(d) => v1_13::CellValueSchema::Date(d),
        current::CellValueSchema::Time(t) => v1_13::CellValueSchema::Time(t),
        current::CellValueSchema::DateTime(dt) => v1_13::CellValueSchema::DateTime(dt),
        current::CellValueSchema::Duration(d) => v1_13::CellValueSchema::Duration(d),
        current::CellValueSchema::Error(e) => v1_13::CellValueSchema::Error(e),
        current::CellValueSchema::Image(s) => v1_13::CellValueSchema::Image(s),
        current::CellValueSchema::RichText(spans) => v1_13::CellValueSchema::RichText(spans),
    }
}

fn upgrade_column(column: current::ColumnSchema) -> v1_13::ColumnSchema {
    column
        .into_iter()
        .map(|(y, cell_value)| (y, upgrade_cell_value(cell_value)))
        .collect()
}

fn upgrade_columns(columns: current::ColumnsSchema) -> v1_13::ColumnsSchema {
    columns
        .into_iter()
        .map(|(x, column)| (x, upgrade_column(column)))
        .collect()
}

fn upgrade_table_columns(columns: current::DataTableColumnSchema) -> v1_13::DataTableColumnSchema {
    v1_13::DataTableColumnSchema {
        name: upgrade_cell_value(columns.name),
        display: columns.display,
        value_index: columns.value_index,
    }
}

fn upgrade_output_array_value(value: current::OutputArraySchema) -> v1_13::OutputArraySchema {
    v1_13::OutputArraySchema {
        size: value.size,
        values: value.values.into_iter().map(upgrade_cell_value).collect(),
    }
}

fn upgrade_output_value(value: current::OutputValueSchema) -> v1_13::OutputValueSchema {
    match value {
        current::OutputValueSchema::Single(value) => {
            v1_13::OutputValueSchema::Single(upgrade_cell_value(value))
        }
        current::OutputValueSchema::Array(value) => {
            v1_13::OutputValueSchema::Array(upgrade_output_array_value(value))
        }
    }
}

fn upgrade_table(table: current::DataTableSchema) -> v1_13::DataTableSchema {
    v1_13::DataTableSchema {
        kind: table.kind,
        name: table.name,
        value: upgrade_output_value(table.value),
        last_modified: table.last_modified,
        header_is_first_row: table.header_is_first_row,
        show_name: table.show_name,
        show_columns: table.show_columns,
        columns: table
            .columns
            .map(|columns| columns.into_iter().map(upgrade_table_columns).collect()),
        sort: table.sort,
        sort_dirty: table.sort_dirty,
        display_buffer: table.display_buffer,
        alternating_colors: table.alternating_colors,
        formats: table.formats,
        borders: table.borders,
        chart_pixel_output: table.chart_pixel_output,
        chart_output: table.chart_output,
    }
}

/// Processes a sheet, converting single-cell code DataTables to CellValue::Code.
pub fn upgrade_sheet(sheet: current::SheetSchema) -> v1_13::SheetSchema {
    // Start with upgraded columns
    let mut columns = upgrade_columns(sheet.columns);

    // Separate data_tables into those that stay as DataTables and those that become CellValue::Code
    let mut remaining_tables = Vec::new();

    for (pos, table) in sheet.data_tables {
        if is_single_cell_code(&table) {
            // Convert to CellValue::Code
            if let Some(code_run) = extract_code_run(&table.kind) {
                let output = upgrade_cell_value(get_single_output(&table.value));
                let last_modified = table
                    .last_modified
                    .map(|dt| dt.timestamp_millis())
                    .unwrap_or_else(|| Utc::now().timestamp_millis());

                let code_cell = v1_13::SingleCodeCellSchema {
                    code_run,
                    output,
                    last_modified,
                };

                // Add to columns at the position
                let x = pos.x;
                let y = pos.y;

                // Find or create the column
                let column_entry = columns.iter_mut().find(|(col_x, _)| *col_x == x);

                if let Some((_, column)) = column_entry {
                    // Add to existing column. The order doesn't matter since this
                    // is serialization and the order is already set.
                    column.push((y, v1_13::CellValueSchema::Code(Box::new(code_cell))));
                } else {
                    // Create new column
                    columns.push((
                        x,
                        vec![(y, v1_13::CellValueSchema::Code(Box::new(code_cell)))],
                    ));
                }
            }
        } else {
            // Keep as DataTable
            remaining_tables.push((pos, upgrade_table(table)));
        }
    }

    v1_13::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        validations: sheet.validations,
        columns,
        data_tables: remaining_tables,
        rows_resize: sheet.rows_resize,
        borders: sheet.borders,
        merge_cells: sheet.merge_cells,
        formats: sheet.formats,
        conditional_formats: sheet.conditional_formats,
    }
}

/// Upgrades a v1_12 grid to v1_13.
/// Converts single-cell code DataTables to CellValue::Code in columns.
pub fn upgrade(grid: current::GridSchema) -> Result<v1_13::GridSchema> {
    let new_grid = v1_13::GridSchema {
        version: Some("1.13".to_string()),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_single_cell_code_formula() {
        // A formula with 1x1 output and no UI is single-cell
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Formula,
                code: "A1+B1".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: None,
                cells_accessed: vec![],
                error: None,
                return_type: None,
                line_number: None,
                output_type: None,
            })),
            name: "Formula1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Number(
                "42".to_string(),
            )),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        assert!(is_single_cell_code(&table));
    }

    #[test]
    fn test_is_not_single_cell_with_ui() {
        // A formula with UI shown is not single-cell
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Formula,
                code: "A1+B1".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: None,
                cells_accessed: vec![],
                error: None,
                return_type: None,
                line_number: None,
                output_type: None,
            })),
            name: "Formula1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Number(
                "42".to_string(),
            )),
            last_modified: None,
            header_is_first_row: false,
            show_name: Some(true), // Has UI!
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        assert!(!is_single_cell_code(&table));
    }

    #[test]
    fn test_is_not_single_cell_array_output() {
        // A formula with array output is not single-cell
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Formula,
                code: "A1:A10".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: None,
                cells_accessed: vec![],
                error: None,
                return_type: None,
                line_number: None,
                output_type: None,
            })),
            name: "Formula1".to_string(),
            value: current::OutputValueSchema::Array(current::OutputArraySchema {
                size: current::OutputSizeSchema { w: 1, h: 10 },
                values: vec![current::CellValueSchema::Number("1".to_string()); 10],
            }),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        assert!(!is_single_cell_code(&table));
    }

    #[test]
    fn test_import_is_not_single_cell() {
        // Imports are never single-cell
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::Import(current::ImportSchema {
                file_name: "test.csv".to_string(),
            }),
            name: "test.csv".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Blank),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        assert!(!is_single_cell_code(&table));
    }

    #[test]
    fn test_is_not_single_cell_with_error() {
        // A formula with an error is not single-cell (matches runtime behavior)
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Formula,
                code: "1/0".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: Some("Error: DivideByZero".to_string()), // Has error!
                cells_accessed: vec![],
                error: None,
                return_type: None,
                line_number: None,
                output_type: None,
            })),
            name: "Formula1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Error(
                current::RunErrorSchema {
                    span: None,
                    msg: current::RunErrorMsgSchema::DivideByZero,
                },
            )),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        assert!(!is_single_cell_code(&table));
    }

    #[test]
    fn test_is_not_single_cell_with_code_run_error() {
        // A Python/JS code cell with code_run.error is not single-cell
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Python,
                code: "invalid code".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: None,
                cells_accessed: vec![],
                error: Some(current::RunErrorSchema {
                    span: None,
                    msg: current::RunErrorMsgSchema::CodeRunError("SyntaxError".into()),
                }), // Has error!
                return_type: None,
                line_number: None,
                output_type: None,
            })),
            name: "Python1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Blank),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        assert!(!is_single_cell_code(&table));
    }

    #[test]
    fn test_is_single_cell_python_with_stderr_warning() {
        // A Python code cell with std_err (but no error) should still qualify
        // because std_err may contain warnings, not errors
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Python,
                code: "import warnings; warnings.warn('test'); 42".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: Some("DeprecationWarning: test".to_string()), // Has warning but no error!
                cells_accessed: vec![],
                error: None, // No error
                return_type: Some("int".to_string()),
                line_number: None,
                output_type: None,
            })),
            name: "Python1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Number(
                "42".to_string(),
            )),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        // Should qualify because error is None (std_err contains warning, not error)
        assert!(is_single_cell_code(&table));
    }

    #[test]
    fn test_is_not_single_cell_html_chart() {
        // A Python chart (HTML output like Plotly) must stay as a DataTable
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Python,
                code: "fig.show()".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: None,
                cells_accessed: vec![],
                error: None,
                return_type: Some("chart".to_string()),
                line_number: None,
                output_type: None,
            })),
            name: "Python1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Html(
                "<html>chart</html>".to_string(),
            )),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: Some((550.0, 400.0)),
            chart_output: Some((7, 22)),
        };
        assert!(!is_single_cell_code(&table));
    }

    #[test]
    fn test_is_not_single_cell_image_chart() {
        // A JS chart (Image output) must stay as a DataTable
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Javascript,
                code: "chart code".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: None,
                cells_accessed: vec![],
                error: None,
                return_type: Some("image".to_string()),
                line_number: None,
                output_type: None,
            })),
            name: "JavaScript1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Image(
                "data:image/png;base64,...".to_string(),
            )),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: Some((400.0, 300.0)),
            chart_output: Some((5, 15)),
        };
        assert!(!is_single_cell_code(&table));
    }

    #[test]
    fn test_is_not_single_cell_blank_output() {
        // A code cell with blank output (placeholder) must not be converted
        let table = current::DataTableSchema {
            kind: current::DataTableKindSchema::CodeRun(Box::new(current::CodeRunSchema {
                language: current::CodeCellLanguageSchema::Python,
                code: "x = 1".to_string(),
                formula_ast: None,
                std_out: None,
                std_err: None,
                cells_accessed: vec![],
                error: None,
                return_type: None,
                line_number: None,
                output_type: None,
            })),
            name: "Python1".to_string(),
            value: current::OutputValueSchema::Single(current::CellValueSchema::Blank),
            last_modified: None,
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            columns: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            alternating_colors: false,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        };
        assert!(!is_single_cell_code(&table));
    }
}
