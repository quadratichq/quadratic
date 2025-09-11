use anyhow::Result;

use crate::grid::file::v1_11;
use crate::grid::file::v1_12;

fn upgrade_cell_value(value: v1_11::CellValueSchema) -> v1_12::CellValueSchema {
    match value {
        v1_11::CellValueSchema::Blank => v1_12::CellValueSchema::Blank,
        v1_11::CellValueSchema::Text(s) => v1_12::CellValueSchema::Text(s),
        v1_11::CellValueSchema::Number(s) => v1_12::CellValueSchema::Number(s),
        v1_11::CellValueSchema::Html(s) => v1_12::CellValueSchema::Html(s),
        v1_11::CellValueSchema::Logical(b) => v1_12::CellValueSchema::Logical(b),
        v1_11::CellValueSchema::Instant(s) => v1_12::CellValueSchema::Instant(s),
        v1_11::CellValueSchema::Date(d) => v1_12::CellValueSchema::Date(d),
        v1_11::CellValueSchema::Time(t) => v1_12::CellValueSchema::Time(t),
        v1_11::CellValueSchema::DateTime(dt) => v1_12::CellValueSchema::DateTime(dt),
        v1_11::CellValueSchema::Duration(d) => v1_12::CellValueSchema::Duration(d),
        v1_11::CellValueSchema::Error(e) => v1_12::CellValueSchema::Error(e),
        v1_11::CellValueSchema::Image(s) => v1_12::CellValueSchema::Image(s),

        // these are removed
        v1_11::CellValueSchema::Code(_) => v1_12::CellValueSchema::Blank,
        v1_11::CellValueSchema::Import(_) => v1_12::CellValueSchema::Blank,
    }
}

fn upgrade_column(column: v1_11::ColumnSchema) -> v1_12::ColumnSchema {
    column
        .into_iter()
        .map(|(y, cell_value)| (y, upgrade_cell_value(cell_value)))
        .collect()
}

fn upgrade_columns(columns: v1_11::ColumnsSchema) -> v1_12::ColumnsSchema {
    columns
        .into_iter()
        .map(|(x, column)| (x, upgrade_column(column)))
        .collect()
}

pub fn upgrade_sheet(sheet: v1_11::SheetSchema) -> v1_12::SheetSchema {
    v1_12::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        validations: sheet.validations,
        columns: upgrade_columns(sheet.columns),
        data_tables: sheet.data_tables,
        rows_resize: sheet.rows_resize,
        borders: sheet.borders,
        formats: sheet.formats,
    }
}

// Removes CellValue::Code and CellValue::Import from the grid
pub fn upgrade(grid: v1_11::GridSchema) -> Result<v1_12::GridSchema> {
    let new_grid = v1_12::GridSchema {
        version: Some("1.12".to_string()),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}
