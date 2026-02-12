#![allow(unused)] // TODO: remove this

use anyhow::Result;
use indexmap::IndexMap;
use itertools::Itertools;
use sheets::{export_sheet, import_sheet};

use crate::grid::Grid;
pub use crate::grid::file::current;

use super::CURRENT_VERSION;

pub(crate) mod borders;
pub(crate) mod cell_value;
pub(crate) mod column;
pub(crate) mod conditional_format;
pub(crate) mod contiguous_2d;
pub(crate) mod data_table;
pub(crate) mod formats;
pub(crate) mod formula;
pub(crate) mod row_resizes;
pub(crate) mod selection;
pub mod sheets;
pub(crate) mod validations;

pub fn import(file: current::GridSchema) -> Result<Grid> {
    let mut sheets = IndexMap::new();
    for sheet_schema in file.sheets {
        let sheet = import_sheet(sheet_schema)?;
        sheets.insert(sheet.id, sheet);
    }
    let mut grid = Grid { sheets };
    let a1_context = grid.expensive_make_a1_context();
    for sheet in grid.sheets.values_mut() {
        sheet.recalculate_bounds(&a1_context);
    }
    Ok(grid)
}

pub fn export(grid: Grid) -> Result<current::GridSchema> {
    Ok(current::GridSchema {
        version: Some(CURRENT_VERSION.into()),
        sheets: grid.sheets.into_values().map(export_sheet).collect(),
    })
}
