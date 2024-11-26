use std::str::FromStr;

use anyhow::Result;

use crate::{
    grid::{GridBounds, Sheet, SheetFormatting, SheetId},
    sheet_offsets::SheetOffsets,
};

use super::{
    borders::{export_borders, import_borders},
    code_cell::{export_rows_code_runs, import_code_cell_builder},
    column::{export_column_builder, import_column_builder},
    current,
    format::{
        export_format, export_formats, export_rows_size, import_format, import_formats,
        import_rows_size,
    },
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

        code_runs: import_code_cell_builder(sheet.code_runs)?,
        data_bounds: GridBounds::Empty,
        format_bounds: GridBounds::Empty,

        format: SheetFormatting::default(),

        validations: import_validations(sheet.validations),
        rows_resize: import_rows_size(sheet.rows_resize)?,

        borders: import_borders(sheet.borders),
    };
    dbgjs!("TODO: serialize formats");
    new_sheet.recalculate_bounds();
    Ok(new_sheet)
}

pub(crate) fn export_sheet(sheet: Sheet) -> current::SheetSchema {
    dbgjs!("TODO: serialize formats");
    current::SheetSchema {
        id: current::IdSchema {
            id: sheet.id.to_string(),
        },
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets.export(),
        formats_all: None,       // todo!("update schema"),
        formats_columns: vec![], // todo!("update schema"),
        formats_rows: vec![],    // todo!("update schema"),
        validations: export_validations(sheet.validations),
        rows_resize: export_rows_size(sheet.rows_resize),
        borders: export_borders(sheet.borders),
        code_runs: export_rows_code_runs(sheet.code_runs),
        columns: export_column_builder(sheet.columns),
    }
}
