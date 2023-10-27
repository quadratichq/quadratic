use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

use super::Grid;

pub mod current;
mod v1_3;
mod v1_4;

pub static CURRENT_VERSION: &str = "1.4";

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "version")]
enum GridFile {
    #[serde(rename = "1.4")]
    V1_4 {
        #[serde(flatten)]
        grid: v1_4::schema::GridSchema,
    },
    #[serde(rename = "1.3")]
    V1_3 {
        #[serde(flatten)]
        grid: v1_3::schema::GridSchema,
    },
}

impl GridFile {
    fn into_latest(self) -> Result<v1_4::schema::GridSchema> {
        match self {
            GridFile::V1_4 { grid } => Ok(grid),
            GridFile::V1_3 { grid } => v1_3::file::upgrade(grid),
        }
    }
}

pub fn import(file_contents: &str) -> Result<Grid> {
    // println!("{}", &file_contents);
    let file = serde_json::from_str::<GridFile>(file_contents)
        .map_err(|e| {
            dbg!(&e);
            return anyhow!(e);
        })?
        .into_latest()?;

    current::import(file)
}

pub fn export(grid: &mut Grid) -> Result<String> {
    let converted = current::export(grid)?;
    let serialized = serde_json::to_string(&converted).map_err(|e| anyhow!(e))?;

    Ok(serialized)
}

#[cfg(test)]
mod tests {
    use crate::{
        color::Rgba,
        grid::{
            generate_borders, set_region_borders, BorderSelection, BorderStyle, CellBorderLine,
        },
        Pos, Rect,
    };

    use super::*;

    const V1_3_FILE: &str = include_str!("../../../examples/v1_3.grid");
    const V1_3_PYTHON_FILE: &str = include_str!("../../../examples/v1_3_python.grid");
    const V1_3_TEXT_ONLY_CODE_CELL_FILE: &str =
        include_str!("../../../examples/c1_3_python_text_only.grid");
    const V1_3_SINGLE_FORMULS_CODE_CELL_FILE: &str =
        include_str!("../../../examples/v1_3_single_formula.grid");
    const V1_3_NPM_DOWNLOADS_FILE: &str = include_str!("../../../examples/v1_3_fill_color.grid");
    const V1_4_FILE: &str = include_str!("../../../examples/v1_4_simple.grid");

    #[test]
    fn process_a_v1_3_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let mut imported = import(V1_3_FILE).unwrap();
        let _exported = export(&mut imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_python_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let mut imported = import(V1_3_PYTHON_FILE).unwrap();
        let _exported = export(&mut imported).unwrap();
        println!("{:#?}", imported);
    }

    #[test]
    fn process_a_v1_3_python_text_only_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let mut imported = import(V1_3_TEXT_ONLY_CODE_CELL_FILE).unwrap();
        let _exported = export(&mut imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_single_formula_file() {
        let mut imported = import(V1_3_SINGLE_FORMULS_CODE_CELL_FILE).unwrap();
        assert!(imported.sheets[0].columns[&0_i64].spills.get(2).is_some());
        let _exported = export(&mut imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_npm_downloads_file() {
        let mut imported = import(V1_3_NPM_DOWNLOADS_FILE).unwrap();
        let _exported = export(&mut imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    fn process_a_v1_4_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let mut imported = import(V1_4_FILE).unwrap();
        let _exported = export(&mut imported).unwrap();
    }

    #[test]
    fn process_a_blank_v1_4_file() {
        let empty = r#"{"sheets":[{"name":"Sheet 1","id":{"id":"4b42eacf-5737-47a2-ac44-e4929d3abc3a"},"order":"a0","cells":[],"code_cells":[],"formats":[],"columns":[],"rows":[],"offsets":[[],[]],"borders":{"horizontal":{},"vertical":{}}}],"version":"1.4"}"#;
        let mut imported = import(empty).unwrap();
        let _exported = export(&mut imported).unwrap();
    }

    #[test]
    fn process_a_simple_v1_4_borders_file() {
        let empty = r##"{"sheets":[{"id":{"id":"d48a3488-fb1d-438d-ba0b-d4ad81b8c239"},"name":"Sheet 1","color":null,"order":"a0","offsets":[[],[]],"columns":[[0,{"id":{"id":"6287d0f0-b559-4de2-a73f-5b140237b3c4"},"values":{"0":{"y":0,"content":{"Values":[{"type":"text","value":"a"}]}}},"spills":{},"align":{},"wrap":{},"numeric_format":{},"numeric_decimals":{},"bold":{},"italic":{},"text_color":{},"fill_color":{}}]],"rows":[[0,{"id":"a9ed07c9-98af-453d-9b5e-311c48be42f7"}]],"borders":{"6287d0f0-b559-4de2-a73f-5b140237b3c4":[[0,[{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"}]]]},"code_cells":[]}],"version":"1.4"}"##;
        let mut imported = import(empty).unwrap();
        // println!("{:#?}", imported.sheets()[0].borders);
        let _exported = export(&mut imported).unwrap();
        println!("{}", _exported);
    }

    #[test]
    fn process_a_v1_4_borders_file() {
        let mut grid = Grid::new();
        let sheets = grid.sheets_mut();
        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 });
        let region = sheets[0].region(rect);
        let selection = vec![BorderSelection::All];
        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let borders = generate_borders(&sheets[0], &region, selection, Some(style));
        set_region_borders(&mut sheets[0], vec![region.clone()], borders);
        println!("{:#?}", sheets[0].borders);

        let _exported = export(&mut grid).unwrap();
        println!("{}", _exported);
        let mut imported = import(&_exported).unwrap();
        println!("{:#?}", imported.sheets()[0].borders);
        // // println!("{:?}", serde_json::to_string(&sheet.column_).unwrap());
        // println!("{:#?}", &sheets[0].borders.per_cell.borders);
    }
}
