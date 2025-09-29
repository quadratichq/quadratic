#![allow(unused)] // TODO: remove this

use anyhow::Result;
use itertools::Itertools;
use sheets::{export_sheet, import_sheet};

use crate::grid::Grid;
pub(crate) use crate::grid::file::current;

use super::CURRENT_VERSION;

pub(crate) mod borders;
pub(crate) mod cell_value;
pub(crate) mod column;
pub(crate) mod contiguous_2d;
pub(crate) mod data_table;
pub(crate) mod formats;
pub(crate) mod row_resizes;
pub(crate) mod selection;
pub(crate) mod sheets;
pub(crate) mod validations;

pub(crate) fn import(file: current::GridSchema) -> Result<Grid> {
    let mut grid = Grid {
        sheets: file
            .sheets
            .into_iter()
            .map(import_sheet)
            .map_ok(|sheet| (sheet.id, sheet))
            .collect::<Result<_>>()?,
    };
    let a1_context = grid.expensive_make_a1_context();
    for sheet in grid.sheets.values_mut() {
        sheet.recalculate_bounds(&a1_context);
    }
    Ok(grid)
}

pub(crate) fn export(grid: Grid) -> Result<current::GridSchema> {
    Ok(current::GridSchema {
        version: Some(CURRENT_VERSION.into()),
        sheets: grid.sheets.into_values().map(export_sheet).collect(),
    })
}
