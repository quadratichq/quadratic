use serde::{Deserialize, Serialize};

use super::sheet::sheet_offsets::SheetOffsets;

mod V1_3;
mod v1_3;
mod v1_3_schema;
mod v1_4;
mod v1_5;
mod v1_5_new;
mod current {
    pub use crate::grid::*;
    pub use serde::{Deserialize, Serialize};
}

// use v1_3::GridSchemaV1_3;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "version")]
enum GridFile {
    #[serde(rename = "1.5")]
    V1_5 {
        #[serde(flatten)]
        grid: v1_5::GridSchema,
    },

    #[serde(rename = "1.4")]
    V1_4 {
        #[serde(flatten)]
        grid: v1_4::GridSchemaV1_4,
    },
    // #[serde(rename = "1.3")]
    // V1_3 {
    //     #[serde(flatten)]
    //     grid: v1_3::GridSchemaV1_3,
    // },
}
impl GridFile {
    fn into_latest(self) -> Result<v1_5::GridSchema, &'static str> {
        match self {
            GridFile::V1_5 { grid } => Ok(grid),
            GridFile::V1_4 { grid } => grid.into_v1_5(),
            // GridFile::V1_3 { grid } => GridSchemaV1_3::import(&grid.version).unwrap().into_v1_5(),
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
                    offsets: SheetOffsets::import(sheet.offsets),
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
        dependencies: file.dependencies.into_iter().collect(),
    })
}

pub fn version() -> String {
    String::from("1.5")
}

pub fn export(grid: &current::Grid) -> Result<String, String> {
    serde_json::to_string(&GridFile::V1_5 {
        grid: v1_5::GridSchema {
            sheets: grid
                .sheets()
                .into_iter()
                .map(|sheet| v1_5::SheetSchema {
                    id: sheet.id,
                    name: sheet.name.clone(),
                    color: sheet.color.clone(),
                    order: sheet.order.clone(),
                    offsets: sheet.offsets.export(),
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
            dependencies: grid.dependencies.clone().into_iter().collect(),
        },
    })
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {

    use crate::{
        controller::GridController,
        test_util::{assert_cell_value_row, print_table},
        Pos, Rect,
    };

    use super::*;

    const V1_5_FILE: &str = include_str!("../../../examples/v1_5.json");
    const V1_3_FILE: &str = include_str!("../../../examples/v1_3.json");

    const SIMPLE_CSV: &str = r#"city,region,country,population
Southborough,MA,United States,9686
Northbridge,MA,United States,14061
Westborough,MA,United States,29313
Marlborough,MA,United States,38334
Springfield,MA,United States,152227
Springfield,MO,United States,150443
Springfield,NJ,United States,14976
Springfield,OH,United States,64325
Springfield,OR,United States,56032
Concord,NH,United States,42605
"#;

    #[tokio::test]
    async fn exports_and_imports_a_V1_5_grid() {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid().sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let range = Rect::new_span(pos, Pos { x: 3, y: 10 });

        grid_controller
            .import_csv(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos, None)
            .await
            .unwrap();

        grid_controller
            .set_cell_bold(sheet_id, range, Some(true), None)
            .await;

        let exported = export(grid_controller.grid_mut()).unwrap();
        println!("len: {}", exported.len());
        println!("{}", exported);

        // print_table(
        //     &grid_controller,
        //     sheet_id,
        //     Rect::new_span(pos, Pos { x: 3, y: 10 }),
        // );
    }
}
