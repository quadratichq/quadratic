use std::collections::HashMap;

use serde::{Deserialize, Serialize};

mod v1_4;
mod v1_5;
mod current {
    pub use crate::grid::*;
    pub use serde::{Deserialize, Serialize};
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "version")]
enum GridFile {
    #[serde(rename = "1.5")]
    V1_5 {
        #[serde(flatten)]
        grid: v1_5::Grid,
    },

    #[serde(rename = "1.4")]
    V1_4 {
        #[serde(flatten)]
        grid: v1_4::GridFileV1_4,
    },
}
impl GridFile {
    fn into_latest(self) -> Result<v1_5::Grid, &'static str> {
        match self {
            GridFile::V1_5 { grid } => Ok(grid),
            GridFile::V1_4 { grid } => grid.into_v1_5(),
        }
    }
}

pub fn import(file_contents: &str) -> Result<current::Grid, String> {
    let file = serde_json::from_str::<GridFile>(file_contents)
        .map_err(|e| e.to_string())?
        .into_latest()?;

    Ok(current::Grid {
        sheets: file
            .sheets
            .into_iter()
            .map(|sheet| {
                let mut sheet = current::Sheet {
                    id: sheet.id,
                    name: sheet.name,
                    color: sheet.color,
                    order: sheet.order,
                    column_ids: sheet
                        .columns
                        .iter()
                        .map(|(x, column)| (*x, column.id))
                        .collect(),
                    row_ids: sheet.rows.iter().copied().collect(),
                    column_widths: sheet.column_widths.iter().copied().collect(),
                    row_heights: sheet.row_heights.iter().copied().collect(),
                    columns: sheet.columns.into_iter().collect(),
                    borders: sheet.borders,
                    code_cells: sheet.code_cells.into_iter().collect(),
                    data_bounds: current::GridBounds::Empty,
                    format_bounds: current::GridBounds::Empty,
                };
                sheet.recalculate_bounds();
                sheet
            })
            .collect(),
        dependencies: HashMap::new(), // TODO: Implement this
    })
}

pub fn version() -> String {
    String::from("1.5")
}

pub fn export(grid: &current::Grid) -> Result<String, String> {
    serde_json::to_string(&GridFile::V1_5 {
        grid: v1_5::Grid {
            sheets: grid
                .sheets
                .iter()
                .map(|sheet| v1_5::Sheet {
                    id: sheet.id,
                    name: sheet.name.clone(),
                    color: sheet.color.clone(),
                    order: sheet.order.clone(),
                    column_widths: sheet
                        .column_widths()
                        .iter()
                        .map(|(&x, &width)| (x, width))
                        .collect(),
                    row_heights: sheet
                        .row_heights()
                        .iter()
                        .map(|(&y, &height)| (y, height))
                        .collect(),
                    columns: sheet
                        .iter_columns()
                        .map(|(x, column)| (x, column.clone()))
                        .collect(),
                    rows: sheet.iter_rows().collect(),
                    borders: sheet.borders().clone(), // TODO: serialize borders
                    code_cells: sheet
                        .iter_code_cells_locations()
                        .filter_map(|cell_ref| {
                            Some((cell_ref, sheet.get_code_cell_from_ref(cell_ref)?.clone()))
                        })
                        .collect(),
                })
                .collect(),
        },
    })
    .map_err(|e| e.to_string())
}
