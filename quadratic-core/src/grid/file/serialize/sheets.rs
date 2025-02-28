use std::str::FromStr;

use anyhow::Result;

use crate::{
    grid::{sheet::borders::Borders, GridBounds, Sheet, SheetFormatting, SheetId},
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
    let mut new_sheet = Sheet {
        id: SheetId::from_str(&sheet.id.id)?,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: SheetOffsets::import(sheet.offsets),
        columns: import_column_builder(sheet.columns)?,
        data_tables: import_data_table_builder(sheet.data_tables)?,
        data_bounds: GridBounds::Empty,
        format_bounds: GridBounds::Empty,
        rows_resize: import_rows_resize(sheet.rows_resize),
        validations: import_validations(sheet.validations),
        borders: import_borders(sheet.borders),
        formats: import_formats(sheet.formats),
    };
    new_sheet.recalculate_bounds();
    Ok(new_sheet)
}

pub(crate) fn export_sheet(sheet: Sheet) -> current::SheetSchema {
    current::SheetSchema {
        id: current::IdSchema {
            id: sheet.id.to_string(),
        },
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets.export(),
        rows_resize: export_rows_size(sheet.rows_resize),
        validations: export_validations(sheet.validations),
        borders: export_borders(sheet.borders),
        data_tables: export_data_tables(sheet.data_tables),
        formats: export_formats(sheet.formats),
        columns: export_column_builder(sheet.columns),
    }
}
