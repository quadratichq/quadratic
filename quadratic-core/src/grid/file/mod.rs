use crate::compression::{
    add_header, decompress_and_deserialize, deserialize, remove_header, serialize,
    serialize_and_compress, CompressionFormat, SerializationFormat,
};

use super::Grid;
use anyhow::{anyhow, Result};
use migrate_code_cell_references::migrate_code_cell_references;
use serde::{Deserialize, Serialize};
pub use shift_negative_offsets::add_import_offset_to_contiguous_2d_rect;
use shift_negative_offsets::shift_negative_offsets;
use std::fmt::Debug;
use std::str;
pub use v1_7_1::GridSchema as current;

mod migrate_code_cell_references;
pub mod serialize;
pub mod sheet_schema;
mod shift_negative_offsets;
mod v1_3;
mod v1_4;
mod v1_5;
mod v1_6;
mod v1_7;
pub mod v1_7_1;

pub use v1_7_1::{CellsAccessedSchema, CodeRunSchema};

pub static CURRENT_VERSION: &str = "1.7.1";
pub static SERIALIZATION_FORMAT: SerializationFormat = SerializationFormat::Json;
pub static COMPRESSION_FORMAT: CompressionFormat = CompressionFormat::Zlib;
pub static HEADER_SERIALIZATION_FORMAT: SerializationFormat = SerializationFormat::Bincode;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileVersion {
    pub version: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "version")]
enum GridFile {
    #[serde(rename = "1.7.1")]
    V1_7_1 {
        #[serde(flatten)]
        grid: v1_7_1::GridSchema,
    },
    #[serde(rename = "1.7")]
    V1_7 {
        #[serde(flatten)]
        grid: v1_7::schema::GridSchema,
    },
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
    fn into_latest(self) -> Result<v1_7_1::GridSchema> {
        match self {
            GridFile::V1_7_1 { grid } => Ok(grid),
            GridFile::V1_7 { grid } => v1_7::upgrade(grid),
            GridFile::V1_6 { grid } => v1_7::upgrade(v1_6::file::upgrade(grid)?),
            GridFile::V1_5 { grid } => {
                v1_7::upgrade(v1_6::file::upgrade(v1_5::file::upgrade(grid)?)?)
            }
            GridFile::V1_4 { grid } => v1_7::upgrade(v1_6::file::upgrade(v1_5::file::upgrade(
                v1_4::file::upgrade(grid)?,
            )?)?),
            GridFile::V1_3 { grid } => v1_7::upgrade(v1_6::file::upgrade(v1_5::file::upgrade(
                v1_4::file::upgrade(v1_3::file::upgrade(grid)?)?,
            )?)?),
        }
    }
}

/// Imports a file. We check if the first character is `{` to determine if it is
/// a JSON file.
pub fn import(file_contents: Vec<u8>) -> Result<Grid> {
    if file_contents.first() == Some(&b'{') {
        import_json(String::from_utf8(file_contents)?)
    } else {
        import_binary(file_contents)
    }
}

/// Imports a binary file.
fn import_binary(file_contents: Vec<u8>) -> Result<Grid> {
    let (header, data) = remove_header(&file_contents)?;

    let file_version = deserialize::<FileVersion>(&HEADER_SERIALIZATION_FORMAT, header)?;
    let mut check_for_negative_offsets = false;
    let mut grid = match file_version.version.as_str() {
        "1.6" => {
            check_for_negative_offsets = true;
            let schema = decompress_and_deserialize::<v1_6::schema::GridSchema>(
                &SERIALIZATION_FORMAT,
                &COMPRESSION_FORMAT,
                data,
            )?;
            drop(file_contents);
            let schema = v1_7::upgrade(v1_6::file::upgrade(schema)?)?;
            Ok(serialize::import(schema)?)
        }
        "1.7" => {
            check_for_negative_offsets = true;
            let schema = decompress_and_deserialize::<v1_7::schema::GridSchema>(
                &SERIALIZATION_FORMAT,
                &COMPRESSION_FORMAT,
                data,
            )?;
            drop(file_contents);
            Ok(serialize::import(v1_7::upgrade(schema)?)?)
        }
        "1.7.1" => {
            let schema = decompress_and_deserialize::<current>(
                &SERIALIZATION_FORMAT,
                &COMPRESSION_FORMAT,
                data,
            )?;
            drop(file_contents);
            Ok(serialize::import(schema)?)
        }
        _ => Err(anyhow::anyhow!(
            "Unsupported file version: {}",
            file_version.version
        )),
    };

    handle_negative_offsets(&mut grid, check_for_negative_offsets);

    grid
}

fn handle_negative_offsets(grid: &mut Result<Grid>, check_for_negative_offsets: bool) {
    if !check_for_negative_offsets {
        return;
    }

    if let Ok(grid) = grid {
        let shifted_offsets = shift_negative_offsets(grid);
        migrate_code_cell_references(grid, &shifted_offsets);
    }
}

fn import_json(file_contents: String) -> Result<Grid> {
    let json = serde_json::from_str::<GridFile>(&file_contents).map_err(|e| {
        dbg!(&e);
        anyhow!(e)
    })?;
    drop(file_contents);

    let check_for_negative_offsets = matches!(
        &json,
        GridFile::V1_3 { .. }
            | GridFile::V1_4 { .. }
            | GridFile::V1_5 { .. }
            | GridFile::V1_6 { .. }
            | GridFile::V1_7 { .. }
    );

    let file = json.into_latest()?;
    let mut grid = serialize::import(file);

    handle_negative_offsets(&mut grid, check_for_negative_offsets);

    grid
}

pub fn export(grid: Grid) -> Result<Vec<u8>> {
    let version = FileVersion {
        version: CURRENT_VERSION.into(),
    };
    let header = serialize(&HEADER_SERIALIZATION_FORMAT, &version)?;

    let converted = serialize::export(grid)?;
    let compressed =
        serialize_and_compress::<current>(&SERIALIZATION_FORMAT, &COMPRESSION_FORMAT, converted)?;
    let data = add_header(header, compressed)?;

    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{BorderSelection, BorderStyle, CodeCellLanguage, CodeCellValue},
        selection::OldSelection,
        ArraySize, CellValue, Pos, SheetPos,
    };
    use serial_test::parallel;

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
    const V1_5_QAWOLF_TEST_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_5_(Main)_QAWolf_test.grid");
    const V1_5_UPGRADE_CODE_RUNS: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_5_upgrade_code_runs.grid");
    const V1_5_JAVASCRIPT_GETTING_STARTED_EXAMPLE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/grid/v1_5_JavaScript_getting_started_(example).grid");

    #[test]
    fn process_a_number_v1_3_file() {
        let imported = import(V1_3_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let exported_test = import_binary(exported).unwrap();
        assert_eq!(imported, exported_test);
    }

    #[test]
    #[parallel]
    fn process_a_v1_3_file() {
        let imported = import(V1_3_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let exported_test = import_binary(exported).unwrap();
        assert_eq!(imported, exported_test);
    }

    #[test]
    #[parallel]
    fn process_a_v1_3_python_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_3_PYTHON_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        assert_eq!(imported, import_binary(exported).unwrap());
    }

    #[test]
    #[parallel]
    fn process_a_v1_3_python_text_only_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_3_TEXT_ONLY_CODE_CELL_FILE.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
    }

    #[test]
    #[parallel]
    fn process_a_v1_3_single_formula_file() {
        let imported = import(V1_3_SINGLE_FORMULAS_CODE_CELL_FILE.to_vec()).unwrap();
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
        let _exported = export(imported).unwrap();
    }

    #[test]
    #[parallel]
    fn process_a_v1_3_npm_downloads_file() {
        let imported = import(V1_3_NPM_DOWNLOADS_FILE.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    #[parallel]
    fn process_a_v1_4_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_4_FILE.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
    }

    #[test]
    #[parallel]
    fn process_a_blank_v1_4_file() {
        let empty =
            r#"{"sheets":[{"name":"Sheet 1","id":{"id":"4b42eacf-5737-47a2-ac44-e4929d3abc3a"},"order":"a0","cells":[],"code_cells":[],"formats":[],"columns":[],"rows":[],"offsets":[[],[]],"borders":{}}],"version":"1.4"}"#.as_bytes();
        let imported = import(empty.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
    }

    #[test]
    #[parallel]
    fn process_a_v1_3_borders_file() {
        let imported = import(V1_3_BORDERS_FILE.to_vec()).unwrap();
        // println!("{:?}", imported.sheets[0].borders);
        let _exported = export(imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    #[parallel]
    fn process_a_simple_v1_4_borders_file() {
        let empty = r##"{"sheets":[{"id":{"id":"d48a3488-fb1d-438d-ba0b-d4ad81b8c239"},"name":"Sheet 1","color":null,"order":"a0","offsets":[[],[]],"columns":[[0,{"id":{"id":"6287d0f0-b559-4de2-a73f-5b140237b3c4"},"values":{"0":{"y":0,"content":{"Values":[{"type":"text","value":"a"}]}}},"spills":{},"align":{},"wrap":{},"numeric_format":{},"numeric_decimals":{},"numeric_commas":{},"bold":{},"italic":{},"text_color":{},"fill_color":{}}]],"rows":[[0,{"id":"a9ed07c9-98af-453d-9b5e-311c48be42f7"}]],"borders":{"6287d0f0-b559-4de2-a73f-5b140237b3c4":[[0,[{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"}]]]},"code_cells":[]}],"version":"1.4"}"##.as_bytes();
        let imported = import(empty.to_vec()).unwrap();
        // println!("{:#?}", imported.sheets()[0].borders);
        let _exported = export(imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    #[parallel]
    fn process_a_v1_4_borders_file() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::sheet_pos(SheetPos::new(sheet_id, 0, 0)),
            BorderSelection::Bottom,
            Some(BorderStyle::default()),
            None,
        );

        let exported = export(gc.grid().clone()).unwrap();
        let imported = import(exported).unwrap();
        assert_eq!(imported, gc.grid().clone());
    }

    #[test]
    #[parallel]
    fn process_a_v1_4_airports_distance_file() {
        let imported = import(V1_4_AIRPORTS_DISTANCE_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported, imported_copy);
    }

    #[test]
    #[parallel]
    fn imports_and_exports_v1_4_default() {
        let imported = import(V1_4_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    #[parallel]
    fn imports_and_exports_a_v1_5_grid() {
        let imported = import(V1_5_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    #[parallel]
    fn imports_and_exports_a_v1_6_grid() {
        let imported = import(V1_6_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    #[parallel]
    fn imports_and_exports_v1_5_qawolf_test_file() {
        let imported = import(V1_5_QAWOLF_TEST_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    #[parallel]
    fn imports_and_exports_v1_5_update_code_runs_file() {
        let imported = import(V1_5_UPGRADE_CODE_RUNS.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    #[parallel]
    fn imports_and_exports_v1_5_javascript_getting_started_example() {
        todo!();
        // let imported = import(V1_5_JAVASCRIPT_GETTING_STARTED_EXAMPLE.to_vec()).unwrap();
        // let exported = export(imported.clone()).unwrap();
        // let imported_copy = import(exported).unwrap();
        // assert_eq!(imported_copy, imported);

        // let sheet = &imported.sheets[0];
        // assert_eq!(
        //     sheet.cell_value(Pos { x: 0, y: 0 }).unwrap(),
        //     CellValue::Text("JavaScript examples".into())
        // );
        // assert_eq!(
        //     sheet.cell_value(Pos { x: 0, y: 3 }).unwrap(),
        //     CellValue::Code(CodeCellValue {
        //         language: CodeCellLanguage::Javascript,
        //         code: "let result = [];\nfor (let i = 0; i < 500; i++) {\n    result.push(2 ** i);\n}\nreturn result;".to_string(),
        //     })
        // );
        // assert_eq!(
        //     sheet
        //         .code_runs
        //         .get(&Pos { x: 0, y: 3 })
        //         .unwrap()
        //         .output_size(),
        //     ArraySize::new(1, 500).unwrap()
        // );
        // assert_eq!(
        //     sheet.cell_value(Pos { x: 2, y: 6 }).unwrap(),
        //     CellValue::Code(CodeCellValue {
        //         language: CodeCellLanguage::Javascript,
        //         code: "// fix by putting a let statement in front of x \nx = 5; ".to_string(),
        //     })
        // );
        // assert_eq!(sheet.code_runs.len(), 10);
        // assert_eq!(
        //     sheet.code_runs.get(&Pos { x: 2, y: 6 }).unwrap().std_err,
        //     Some("x is not defined".into())
        // );
    }
}
