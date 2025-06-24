use anyhow::Result;

use crate::grid::file::v1_10 as current;
use crate::grid::file::v1_11;

/// This upgrade is only related to the compression method
pub fn upgrade(grid: current::GridSchema) -> Result<v1_11::GridSchema> {
    let new_grid = v1_11::GridSchema {
        version: Some("1.11".to_string()),
        sheets: grid.sheets,
    };
    Ok(new_grid)
}
