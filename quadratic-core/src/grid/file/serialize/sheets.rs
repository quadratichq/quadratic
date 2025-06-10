use std::str::FromStr;

use anyhow::Result;

use crate::{
    grid::{GridBounds, Sheet, SheetFormatting, SheetId, sheet::borders::Borders},
    sheet_offsets::SheetOffsets,
};

use super::{
    borders::{export_borders, import_borders},
    column::{export_column_builder, import_column_builder},
    current,
    data_table::{export_data_tables, import_data_table_builder},
    formats::{export_formats, import_formats},
    row_resizes::{export_rows_size, import_rows_resize},
    validations::{export_validations, import_validations},
};

pub fn import_sheet(sheet: current::SheetSchema) -> Result<Sheet> {
    Ok(Sheet {
        id: SheetId::from_str(&sheet.id.id)?,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        borders: import_borders(sheet.borders),
        formats: import_formats(sheet.formats),
        offsets: SheetOffsets::import(sheet.offsets),
        rows_resize: import_rows_resize(sheet.rows_resize),
        validations: import_validations(sheet.validations),
        columns: import_column_builder(sheet.columns),
        data_tables: import_data_table_builder(sheet.data_tables)?,
        data_bounds: GridBounds::Empty,
        format_bounds: GridBounds::Empty,
    })
}

pub(crate) fn export_sheet(sheet: Sheet) -> current::SheetSchema {
    current::SheetSchema {
        id: current::IdSchema {
            id: sheet.id.to_string(),
        },
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        borders: export_borders(sheet.borders),
        formats: export_formats(sheet.formats),
        offsets: sheet.offsets.export(),
        rows_resize: export_rows_size(sheet.rows_resize),
        validations: export_validations(sheet.validations),
        columns: export_column_builder(sheet.columns),
        data_tables: export_data_tables(sheet.data_tables),
    }
}
