use std::str::FromStr;

use anyhow::Result;

use crate::{
    grid::{GridBounds, Sheet, SheetId},
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
        name: sheet.name.to_owned(),
        color: sheet.color.to_owned(),
        order: sheet.order.to_owned(),
        offsets: SheetOffsets::import(&sheet.offsets),
        columns: import_column_builder(&sheet.columns)?,

        code_runs: import_code_cell_builder(&sheet)?,
        data_bounds: GridBounds::Empty,
        format_bounds: GridBounds::Empty,

        format_all: sheet.formats_all.as_ref().map(import_format),
        formats_columns: import_formats(&sheet.formats_columns),
        formats_rows: import_formats(&sheet.formats_rows),

        validations: import_validations(&sheet.validations),
        rows_resize: import_rows_size(&sheet.rows_resize)?,

        borders: import_borders(&sheet.borders),
    };
    new_sheet.recalculate_bounds();
    Ok(new_sheet)
}

pub(crate) fn export_sheet(sheet: Sheet) -> current::SheetSchema {
    current::SheetSchema {
        id: current::IdSchema {
            id: sheet.id.to_string(),
        },
        name: sheet.name.to_owned(),
        color: sheet.color.to_owned(),
        order: sheet.order.to_owned(),
        offsets: sheet.offsets.export(),
        formats_all: sheet.format_all.as_ref().and_then(export_format),
        formats_columns: export_formats(&sheet.formats_columns),
        formats_rows: export_formats(&sheet.formats_rows),
        validations: export_validations(&sheet.validations),
        rows_resize: export_rows_size(&sheet),
        borders: export_borders(&sheet.borders),
        code_runs: export_rows_code_runs(&sheet),
        columns: export_column_builder(&sheet),
    }
}
