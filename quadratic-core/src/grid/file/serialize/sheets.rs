use std::str::FromStr;

use anyhow::Result;

use crate::{
    grid::{sheet::borders_a1::BordersA1, GridBounds, Sheet, SheetFormatting, SheetId},
    sheet_offsets::SheetOffsets,
};

use super::{
    borders::{export_borders, import_borders},
    borders_a1::{export_borders_a1, import_borders_a1},
    code_cell::{export_rows_code_runs, import_code_cell_builder},
    column::{export_column_builder, import_column_builder},
    current,
    format::{export_formats, import_formats},
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
        rows_resize: import_rows_resize(sheet.rows_resize),
        validations: import_validations(sheet.validations),
        borders: import_borders(sheet.borders),
        borders_a1: import_borders_a1(sheet.borders_a1),
        formats: import_formats(sheet.formats),
        code_runs: import_code_cell_builder(sheet.code_runs)?,
        columns: import_column_builder(sheet.columns)?,
        format_bounds: GridBounds::Empty,
        data_bounds: GridBounds::Empty,
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
        borders_a1: export_borders_a1(sheet.borders_a1),
        formats: export_formats(sheet.formats),
        code_runs: export_rows_code_runs(sheet.code_runs),
        columns: export_column_builder(sheet.columns),
    }
}
