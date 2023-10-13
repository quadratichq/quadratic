use anyhow::{anyhow, Result};
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
    #[serde(rename = "1.6")]
    V1_6 {
        #[serde(flatten)]
        grid: current::Grid,
    },

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
}
impl GridFile {
    fn into_latest(self) -> Result<current::Grid> {
        match self {
            GridFile::V1_6 { grid } => Ok(grid),
            _ => unimplemented!(),
        }
    }
}

pub fn version() -> String {
    String::from("1.6")
}

pub fn import(file_contents: &str) -> Result<current::Grid> {
    serde_json::from_str::<GridFile>(&file_contents)
        .map_err(|e| anyhow!("Could not import file: {:?}", e))?
        .into_latest()
}

pub fn export(grid: &current::Grid) -> Result<String> {
    let grid_file = GridFile::V1_6 {
        grid: grid.to_owned(),
    };
    serde_json::to_string(&grid_file).map_err(|e| anyhow!("Could not export grid: {:?}", e))
}

pub fn import_binary(file_contents: &Vec<u8>) -> Result<current::Grid> {
    bincode::deserialize::<GridFile>(file_contents)
        .map_err(|e| anyhow!("Could not import file: {:?}", e))?
        .into_latest()
}

pub fn export_binary(grid: &current::Grid) -> Result<Vec<u8>> {
    let grid_file = GridFile::V1_6 {
        grid: grid.to_owned(),
    };
    bincode::serialize(&grid_file).map_err(|e| anyhow!("Could not export grid: {:?}", e))
}

#[cfg(test)]
mod tests {

    use crate::{controller::GridController, Pos, Rect};

    use super::*;

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
    async fn exports_a_v1_6_grid() {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid().sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let range = Rect::new_span(pos, Pos { x: 3, y: 10 });

        // grid_controller
        //     .import_csv(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos, None)
        //     .await
        //     .unwrap();

        // grid_controller
        //     .set_cell_bold(sheet_id, range, Some(true), None)
        //     .await;

        let exported = export(grid_controller.grid_mut()).unwrap();
        println!("json len: {}", std::mem::size_of_val(&exported));
        print!("{}", &exported);

        let imported = import(&exported).unwrap();

        assert_eq!(grid_controller.grid(), &imported);
    }

    #[tokio::test]
    async fn exports_a_v1_6_grid_binary() {
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

        let exported = export_binary(grid_controller.grid_mut()).unwrap();
        println!("binary len: {}", std::mem::size_of_val(&exported));
        // print!("{:?}", &exported);

        // let imported = import_binary(&exported).unwrap();

        // assert_eq!(grid_controller.grid(), &imported);
    }
}
