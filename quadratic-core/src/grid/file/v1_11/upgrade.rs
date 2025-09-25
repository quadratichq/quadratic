use anyhow::Result;

use crate::grid::file::v1_11;
use crate::grid::file::v1_12;

pub fn upgrade_cell_value(value: v1_11::CellValueSchema) -> v1_12::CellValueSchema {
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

pub fn upgrade_column(column: v1_11::ColumnSchema) -> v1_12::ColumnSchema {
    column
        .into_iter()
        .map(|(y, cell_value)| (y, upgrade_cell_value(cell_value)))
        .collect()
}

pub fn upgrade_columns(columns: v1_11::ColumnsSchema) -> v1_12::ColumnsSchema {
    columns
        .into_iter()
        .map(|(x, column)| (x, upgrade_column(column)))
        .collect()
}

pub fn upgrade_table_columns(
    columns: v1_11::DataTableColumnSchema,
) -> v1_12::DataTableColumnSchema {
    v1_12::DataTableColumnSchema {
        name: upgrade_cell_value(columns.name),
        display: columns.display,
        value_index: columns.value_index,
    }
}

fn upgrade_output_array_value(value: v1_11::OutputArraySchema) -> v1_12::OutputArraySchema {
    v1_12::OutputArraySchema {
        size: value.size,
        values: value.values.into_iter().map(upgrade_cell_value).collect(),
    }
}

pub fn upgrade_output_value(value: v1_11::OutputValueSchema) -> v1_12::OutputValueSchema {
    match value {
        v1_11::OutputValueSchema::Single(value) => {
            v1_12::OutputValueSchema::Single(upgrade_cell_value(value))
        }
        v1_11::OutputValueSchema::Array(value) => {
            v1_12::OutputValueSchema::Array(upgrade_output_array_value(value))
        }
    }
}

pub fn upgrade_table(table: v1_11::DataTableSchema) -> v1_12::DataTableSchema {
    v1_12::DataTableSchema {
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
        spill_value: table.spill_value,
        spill_data_table: table.spill_data_table,
        alternating_colors: table.alternating_colors,
        formats: table.formats,
        borders: table.borders,
        chart_pixel_output: table.chart_pixel_output,
        chart_output: table.chart_output,
    }
}

fn upgrade_tables(tables: v1_11::DataTablesSchema) -> v1_12::DataTablesSchema {
    tables
        .into_iter()
        .map(|(pos, table)| (pos, upgrade_table(table)))
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
        data_tables: upgrade_tables(sheet.data_tables),
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
