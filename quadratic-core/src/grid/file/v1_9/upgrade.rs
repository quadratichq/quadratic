use anyhow::Result;

use crate::grid::file::v1_9 as current;
use crate::grid::file::v1_10;

fn upgrade_data_tables(data_tables: current::DataTablesSchema) -> v1_10::DataTablesSchema {
    data_tables
        .into_iter()
        .map(|(pos, data_table)| {
            let formats = if data_table.formats.is_empty() {
                None
            } else {
                Some(data_table.formats)
            };
            let borders = if data_table.borders.is_empty() {
                None
            } else {
                Some(data_table.borders)
            };

            (
                pos,
                v1_10::DataTableSchema {
                    kind: data_table.kind,
                    name: data_table.name,
                    header_is_first_row: data_table.header_is_first_row,
                    show_name: data_table.show_name,
                    show_columns: data_table.show_columns,
                    columns: data_table.columns,
                    sort: data_table.sort,
                    sort_dirty: data_table.sort_dirty,
                    display_buffer: data_table.display_buffer,
                    value: data_table.value,
                    spill_value: data_table.spill_error,
                    spill_data_table: data_table.spill_error,
                    last_modified: data_table.last_modified,
                    alternating_colors: data_table.alternating_colors,
                    formats,
                    borders,
                    chart_pixel_output: data_table.chart_pixel_output,
                    chart_output: data_table.chart_output,
                },
            )
        })
        .collect()
}

pub(crate) fn upgrade_sheet(sheet: current::SheetSchema) -> v1_10::SheetSchema {
    v1_10::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        validations: sheet.validations,
        columns: sheet.columns,
        data_tables: upgrade_data_tables(sheet.data_tables),
        rows_resize: sheet.rows_resize,
        borders: sheet.borders,
        formats: sheet.formats,
    }
}

pub(crate) fn upgrade(grid: current::GridSchema) -> Result<v1_10::GridSchema> {
    let new_grid = v1_10::GridSchema {
        version: Some("1.10".to_string()),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}
