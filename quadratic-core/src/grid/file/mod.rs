use crate::compression::{decompress_and_deserialize, serialize_and_compress};

use super::Grid;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use std::str;
use v1_6::schema::GridSchema;

pub mod current;
mod v1_3;
mod v1_4;
mod v1_5;
mod v1_6;

pub static CURRENT_VERSION: &str = "1.6";

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "version")]
enum GridFile {
    #[serde(rename = "1.6")]
    V1_6 {
        #[serde(flatten)]
        grid: v1_6::schema::GridSchema,
    },
    #[serde(rename = "1.5")]
    V1_5 {
        #[serde(flatten)]
        grid: v1_5::schema::GridSchema,
    },
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
    fn into_latest(self) -> Result<v1_6::schema::GridSchema> {
        match self {
            GridFile::V1_6 { grid } => Ok(grid),
            GridFile::V1_5 { grid } => v1_5::file::upgrade(grid),
            GridFile::V1_4 { grid } => v1_5::file::upgrade(v1_4::file::upgrade(grid)?),
            GridFile::V1_3 { grid } => {
                v1_5::file::upgrade(v1_4::file::upgrade(v1_3::file::upgrade(grid)?)?)
            }
        }
    }
}

/// Imports a file. We check if the first character is `{` to determine if it is
/// a JSON file.
pub fn import(file_contents: &[u8]) -> Result<Grid> {
    if file_contents[0] == b'{' {
        import_json(str::from_utf8(file_contents)?)
    } else {
        import_binary(file_contents)
    }
}

/// Imports a binary file.
fn import_binary(file_contents: &[u8]) -> Result<Grid> {
    let schema = decompress_and_deserialize::<GridSchema>(file_contents)?;
    current::import(schema)
}

fn import_json(file_contents: &str) -> Result<Grid> {
    let file = serde_json::from_str::<GridFile>(file_contents)
        .map_err(|e| {
            dbg!(&e);
            anyhow!(e)
        })?
        .into_latest()?;
    current::import(file)
}

pub fn export(grid: &Grid) -> Result<Vec<u8>> {
    let converted = current::export(grid)?;
    let compressed = serialize_and_compress::<GridSchema>(&converted)?;

    Ok(compressed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{generate_borders, set_rect_borders, BorderSelection, BorderStyle, CellBorderLine},
        Pos, Rect,
    };

    const V1_3_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_3.grid");
    const V1_3_PYTHON_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_3_python.grid");
    const V1_3_TEXT_ONLY_CODE_CELL_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_3_python_text_only.grid");
    const V1_3_SINGLE_FORMULAS_CODE_CELL_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_3_single_formula.grid");
    const V1_3_NPM_DOWNLOADS_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_3_fill_color.grid");
    const V1_3_BORDERS_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_3_borders.grid");
    const V1_4_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_4_simple.grid");
    const V1_4_AIRPORTS_DISTANCE_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_4_airports_distance.grid");
    const V1_5_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_5_simple.grid");
    const V1_6_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_6_simple.grid");

    #[test]
    fn process_a_number_v1_3_file() {
        let imported = import(V1_3_FILE).unwrap();
        let exported = export(&imported).unwrap();
        let exported_test = import_binary(&exported).unwrap();
        assert_eq!(imported, exported_test);
    }

    #[test]
    fn process_a_v1_3_file() {
        let imported = import(V1_3_FILE).unwrap();
        let exported = export(&imported).unwrap();
        let exported_test = import_binary(&exported).unwrap();
        assert_eq!(imported, exported_test);
    }

    #[test]
    fn process_a_v1_3_python_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_3_PYTHON_FILE).unwrap();
        let exported = export(&imported).unwrap();
        assert_eq!(imported, import_binary(&exported).unwrap());
    }

    #[test]
    fn process_a_v1_3_python_text_only_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_3_TEXT_ONLY_CODE_CELL_FILE).unwrap();
        let _exported = export(&imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_single_formula_file() {
        let imported = import(V1_3_SINGLE_FORMULAS_CODE_CELL_FILE).unwrap();
        assert!(imported.sheets[0]
            .code_runs
            .get(&Pos { x: 0, y: 2 })
            .is_some());
        let cell_value = imported.sheets[0].cell_value(Pos { x: 0, y: 2 }).unwrap();

        match cell_value {
            crate::grid::CellValue::Code(formula) => {
                assert_eq!(formula.code, "SUM(A0:A1)");
            }
            _ => panic!("Expected a formula"),
        };
        let _exported = export(&imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_npm_downloads_file() {
        let imported = import(V1_3_NPM_DOWNLOADS_FILE).unwrap();
        let _exported = export(&imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    fn process_a_v1_4_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_4_FILE).unwrap();
        let _exported = export(&imported).unwrap();
    }

    #[test]
    fn process_a_blank_v1_4_file() {
        let empty =
            r#"{"sheets":[{"name":"Sheet 1","id":{"id":"4b42eacf-5737-47a2-ac44-e4929d3abc3a"},"order":"a0","cells":[],"code_cells":[],"formats":[],"columns":[],"rows":[],"offsets":[[],[]],"borders":{}}],"version":"1.4"}"#.as_bytes();
        let imported = import(empty).unwrap();
        let _exported = export(&imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_borders_file() {
        let imported = import(V1_3_BORDERS_FILE).unwrap();
        // println!("{:?}", imported.sheets[0].borders);
        let _exported = export(&imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    fn process_a_simple_v1_4_borders_file() {
        let empty = r##"{"sheets":[{"id":{"id":"d48a3488-fb1d-438d-ba0b-d4ad81b8c239"},"name":"Sheet 1","color":null,"order":"a0","offsets":[[],[]],"columns":[[0,{"id":{"id":"6287d0f0-b559-4de2-a73f-5b140237b3c4"},"values":{"0":{"y":0,"content":{"Values":[{"type":"text","value":"a"}]}}},"spills":{},"align":{},"wrap":{},"numeric_format":{},"numeric_decimals":{},"numeric_commas":{},"bold":{},"italic":{},"text_color":{},"fill_color":{}}]],"rows":[[0,{"id":"a9ed07c9-98af-453d-9b5e-311c48be42f7"}]],"borders":{"6287d0f0-b559-4de2-a73f-5b140237b3c4":[[0,[{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"}]]]},"code_cells":[]}],"version":"1.4"}"##.as_bytes();
        let imported = import(empty).unwrap();
        // println!("{:#?}", imported.sheets()[0].borders);
        let _exported = export(&imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    fn process_a_v1_4_borders_file() {
        let mut grid = Grid::new();
        let sheets = grid.sheets_mut();
        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 });
        let selection = vec![BorderSelection::Bottom];
        let style = BorderStyle {
            color: Rgba::color_from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let borders = generate_borders(&sheets[0], &rect, selection, Some(style));
        set_rect_borders(&mut sheets[0], &rect, borders);
        // println!("{:#?}", sheets[0].borders);

        // todo: this does not work
        // let _exported = export(&mut grid).unwrap();
        // println!("{}", _exported);
        // let _imported = import(&_exported).unwrap();
        // println!("{:#?}", imported.sheets()[0].borders);
        // // println!("{:?}", serde_json::to_string(&sheet.column_).unwrap());
        // println!("{:#?}", &sheets[0].borders.per_cell.borders);
    }

    #[test]
    fn process_a_v1_4_airports_distance_file() {
        let imported = import(V1_4_AIRPORTS_DISTANCE_FILE).unwrap();
        let exported = export(&imported).unwrap();
        let imported_copy = import(&exported).unwrap();
        assert_eq!(imported, imported_copy);
    }

    #[test]
    fn imports_and_exports_a_v1_5_grid() {
        let imported = import(V1_5_FILE).unwrap();
        let exported = export(&imported).unwrap();
        let imported_copy = import(&exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    fn imports_and_exports_v1_4_default() {
        let imported = import(V1_4_FILE).unwrap();
        let exported = export(&imported).unwrap();
        let imported_copy = import(&exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    fn simple_file_binary() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.add_sheet(None);
        // gc.set_cell_value((0, 0, sheet_id).into(), "a".to_string(), None);

        for x in 0..100 {
            gc.set_cell_value((0, x, sheet_id).into(), "true".into(), None);
        }
        // gc.set_cell_value((1, 0, sheet_id).into(), "12".to_string(), None);
        // gc.set_code_cell(
        //     (0, 1, sheet_id).into(),
        //     crate::grid::CodeCellLanguage::Formula,
        //     "13".into(),
        //     None,
        // );

        let imported = import(V1_6_FILE).unwrap();
        let exported = export(&imported).unwrap();
        // let imported = import(&exported).unwrap();
        // assert_eq!(*gc.grid(), imported);
    }
}
