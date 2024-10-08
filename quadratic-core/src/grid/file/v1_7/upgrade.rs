use anyhow::Result;

use crate::grid::file::v1_7_1;

use super::schema::{self as current};

pub fn upgrade(grid: current::GridSchema) -> Result<v1_7_1::GridSchema> {
    let new_grid = v1_7_1::GridSchema {
        version: Some("1.7.1".to_string()),
        sheets: grid.sheets,
    };
    Ok(new_grid)
}
