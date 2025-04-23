use std::collections::HashMap;

use anyhow::Result;

use crate::grid::file::v1_8 as current;
use crate::grid::file::v1_8_1;

fn upgrade_data_table_kind(
    data_table_kind: current::DataTableKindSchema,
    language: current::CodeCellLanguageSchema,
) -> v1_8_1::DataTableKindSchema {
    match data_table_kind {
        current::DataTableKindSchema::Import(import) => v1_8_1::DataTableKindSchema::Import(import),
        current::DataTableKindSchema::CodeRun(code_run) => {
            v1_8_1::DataTableKindSchema::CodeRun(v1_8_1::CodeRunSchema {
                language,
                std_out: code_run.std_out,
                std_err: code_run.std_err,
                cells_accessed: code_run.cells_accessed,
                error: code_run.error,
                return_type: code_run.return_type,
                line_number: code_run.line_number,
                output_type: code_run.output_type,
            })
        }
    }
}

fn upgrade_data_tables(
    data_tables: current::DataTablesSchema,
    columns: &current::ColumnsSchema,
) -> v1_8_1::DataTablesSchema {
    let mut data_tables_language =
        HashMap::<current::PosSchema, current::CodeCellLanguageSchema>::new();
    for (x, column) in columns {
        for (y, cell) in column {
            match cell {
                current::CellValueSchema::Code(code) => {
                    data_tables_language.insert(
                        current::PosSchema { x: *x, y: *y },
                        code.language.to_owned(),
                    );
                }
                current::CellValueSchema::Import(_) => {
                    data_tables_language.insert(
                        current::PosSchema { x: *x, y: *y },
                        current::CodeCellLanguageSchema::Import,
                    );
                }
                _ => {}
            }
        }
    }

    data_tables
        .into_iter()
        .filter_map(|(pos, data_table)| {
            let language = data_tables_language.remove(&pos)?;

            Some((
                pos,
                v1_8_1::DataTableSchema {
                    kind: upgrade_data_table_kind(data_table.kind, language),
                    name: data_table.name,
                    header_is_first_row: data_table.header_is_first_row,
                    show_ui: Some(data_table.show_ui),
                    show_name: Some(data_table.show_name),
                    show_columns: Some(data_table.show_columns),
                    columns: data_table.columns,
                    sort: data_table.sort,
                    sort_dirty: data_table.sort_dirty,
                    display_buffer: data_table.display_buffer,
                    value: data_table.value,
                    readonly: data_table.readonly,
                    spill_error: data_table.spill_error,
                    last_modified: data_table.last_modified,
                    alternating_colors: data_table.alternating_colors,
                    formats: data_table.formats,
                    borders: data_table.borders,
                    chart_pixel_output: data_table.chart_pixel_output,
                    chart_output: data_table.chart_output,
                },
            ))
        })
        .collect()
}

pub fn upgrade_sheet(sheet: current::SheetSchema) -> v1_8_1::SheetSchema {
    let data_tables = upgrade_data_tables(sheet.data_tables, &sheet.columns);

    v1_8_1::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        validations: sheet.validations,
        columns: sheet.columns,
        data_tables,
        rows_resize: sheet.rows_resize,
        borders: sheet.borders,
        formats: sheet.formats,
    }
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_8_1::GridSchema> {
    let new_grid = v1_8_1::GridSchema {
        version: Some("1.8.1".to_string()),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}
