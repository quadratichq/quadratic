use anyhow::Result;

use crate::grid::file::v1_11 as current;
use crate::grid::file::v1_12;

pub fn upgrade_sheet(sheet: current::SheetSchema) -> v1_12::SheetSchema {
    v1_12::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        validations: sheet.validations,
        columns: sheet.columns,
        data_tables: sheet.data_tables,
        rows_resize: sheet.rows_resize,
        borders: sheet.borders,
        formats: sheet.formats,
    }
}

/// This upgrade is only related to the compression method
pub fn upgrade(grid: current::GridSchema) -> Result<v1_12::GridSchema> {
    let new_grid = v1_12::GridSchema {
        version: Some("1.12".to_string()),
        sheets: grid.sheets,
    };
    Ok(new_grid)
}
