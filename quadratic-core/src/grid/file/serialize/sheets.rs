use std::{cell::RefCell, collections::HashMap, str::FromStr};

use anyhow::Result;

use crate::{
    Pos,
    grid::{
        GridBounds, Sheet, SheetFormatting, SheetId,
        file::serialize::contiguous_2d::{export_contiguous_2d, import_contiguous_2d},
        sheet::{
            borders::Borders, conditional_format::ConditionalFormats, merge_cells::MergeCells,
        },
    },
    sheet_offsets::SheetOffsets,
};

use super::{
    borders::{export_borders, import_borders},
    column::{export_column_builder, import_column_builder},
    conditional_format::{export_conditional_formats, import_conditional_formats},
    current,
    data_table::{export_data_tables, import_data_table_builder},
    formats::{export_formats, import_formats},
    row_resizes::{export_rows_size, import_rows_resize},
    validations::{export_validations, import_validations},
};

fn import_merge_cells(merge_cells: current::MergeCellsSchema) -> MergeCells {
    MergeCells::import(import_contiguous_2d(merge_cells.merge_cells, |v| {
        v.map(|pos| Pos { x: pos.x, y: pos.y })
    }))
}

fn export_merge_cells(merge_cells: &MergeCells) -> current::MergeCellsSchema {
    let merge_cells_data = merge_cells.export().clone();
    current::MergeCellsSchema {
        merge_cells: export_contiguous_2d(merge_cells_data, |v: Option<Pos>| {
            v.map(|pos| current::PosSchema { x: pos.x, y: pos.y })
        }),
    }
}

pub fn import_sheet(sheet: current::SheetSchema) -> Result<Sheet> {
    let columns = import_column_builder(sheet.columns);
    let data_tables = import_data_table_builder(sheet.data_tables, &columns)?;

    let sheet = Sheet {
        id: SheetId::from_str(&sheet.id.id)?,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        borders: import_borders(sheet.borders),
        formats: import_formats(sheet.formats),
        offsets: SheetOffsets::import(sheet.offsets),
        rows_resize: import_rows_resize(sheet.rows_resize),
        validations: import_validations(sheet.validations),
        conditional_formats: import_conditional_formats(sheet.conditional_formats)
            .unwrap_or_default(),
        columns,
        data_tables,
        data_bounds: GridBounds::Empty,
        format_bounds: GridBounds::Empty,
        merge_cells: import_merge_cells(sheet.merge_cells),
        preview_conditional_format: None,
        color_scale_threshold_cache: RefCell::new(HashMap::new()),
    };

    Ok(sheet)
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
        conditional_formats: export_conditional_formats(sheet.conditional_formats),
        columns: export_column_builder(sheet.columns),
        data_tables: export_data_tables(sheet.data_tables),
        merge_cells: export_merge_cells(&sheet.merge_cells),
    }
}
