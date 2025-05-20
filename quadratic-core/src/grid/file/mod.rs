use crate::compression::{
    CompressionFormat, SerializationFormat, add_header, decompress_and_deserialize, deserialize,
    remove_header, serialize, serialize_and_compress,
};

use super::Grid;
use anyhow::{Result, anyhow};
use migrate_code_cell_references::{
    migrate_code_cell_references, replace_formula_a1_references_to_r1c1,
};
use serde::{Deserialize, Serialize};
pub use shift_negative_offsets::{add_import_offset_to_contiguous_2d_rect, shift_negative_offsets};
use std::fmt::Debug;
use std::str;
pub use v1_7_1::{CellsAccessedSchema, CodeRunSchema};
pub use v1_9 as current;

mod migrate_code_cell_references;
pub mod serialize;
pub mod sheet_schema;
mod shift_negative_offsets;
mod v1_3;
mod v1_4;
mod v1_5;
mod v1_6;
mod v1_7;
mod v1_7_1;
mod v1_8;
pub mod v1_9;

pub static CURRENT_VERSION: &str = "1.9";
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
    #[serde(rename = "1.9")]
    V1_9 {
        #[serde(flatten)]
        grid: v1_9::GridSchema,
    },
    #[serde(rename = "1.8")]
    V1_8 {
        #[serde(flatten)]
        grid: v1_8::GridSchema,
    },
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

// TODO(ddimaria): refactor to be recrsive
impl GridFile {
    fn into_latest(self) -> Result<v1_9::GridSchema> {
        match self {
            GridFile::V1_9 { grid } => Ok(grid),
            GridFile::V1_8 { grid } => v1_8::upgrade(grid),
            GridFile::V1_7_1 { grid } => v1_8::upgrade(v1_7_1::upgrade(grid)?),
            GridFile::V1_7 { grid } => v1_8::upgrade(v1_7_1::upgrade(v1_7::upgrade(grid)?)?),
            GridFile::V1_6 { grid } => {
                v1_8::upgrade(v1_7_1::upgrade(v1_7::upgrade(v1_6::file::upgrade(grid)?)?)?)
            }
            GridFile::V1_5 { grid } => v1_8::upgrade(v1_7_1::upgrade(v1_7::upgrade(
                v1_6::file::upgrade(v1_5::file::upgrade(grid)?)?,
            )?)?),
            GridFile::V1_4 { grid } => v1_8::upgrade(v1_7_1::upgrade(v1_7::upgrade(
                v1_6::file::upgrade(v1_5::file::upgrade(v1_4::file::upgrade(grid)?)?)?,
            )?)?),
            GridFile::V1_3 { grid } => {
                v1_8::upgrade(v1_7_1::upgrade(v1_7::upgrade(v1_6::file::upgrade(
                    v1_5::file::upgrade(v1_4::file::upgrade(v1_3::file::upgrade(grid)?)?)?,
                )?)?)?)
            }
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
            let schema = v1_8::upgrade(v1_7_1::upgrade(v1_7::upgrade(v1_6::file::upgrade(
                schema,
            )?)?)?)?;
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
            let schema = v1_8::upgrade(v1_7_1::upgrade(v1_7::upgrade(schema)?)?)?;
            Ok(serialize::import(schema)?)
        }
        "1.7.1" => {
            let schema = decompress_and_deserialize::<v1_7_1::GridSchema>(
                &SERIALIZATION_FORMAT,
                &COMPRESSION_FORMAT,
                data,
            )?;
            drop(file_contents);
            let schema = v1_8::upgrade(v1_7_1::upgrade(schema)?)?;
            Ok(serialize::import(schema)?)
        }
        "1.8" => {
            let schema = decompress_and_deserialize::<v1_8::GridSchema>(
                &SERIALIZATION_FORMAT,
                &COMPRESSION_FORMAT,
                data,
            )?;
            drop(file_contents);
            let schema = v1_8::upgrade(schema)?;
            Ok(serialize::import(schema)?)
        }
        "1.9" => {
            let schema = decompress_and_deserialize::<current::GridSchema>(
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
        replace_formula_a1_references_to_r1c1(grid);
        let shifted_offsets = shift_negative_offsets(grid);
        migrate_code_cell_references(grid, &shifted_offsets);
    }
}

fn import_json(file_contents: String) -> Result<Grid> {
    let json = serde_json::from_str::<GridFile>(&file_contents).map_err(|e| anyhow!(e))?;
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
    let compressed = serialize_and_compress::<current::GridSchema>(
        &SERIALIZATION_FORMAT,
        &COMPRESSION_FORMAT,
        converted,
    )?;
    let data = add_header(header, compressed)?;

    Ok(data)
}

pub fn export_json(grid: Grid) -> Result<Vec<u8>> {
    let converted = serialize::export(grid)?;
    let json = serde_json::to_vec(&converted)?;

    Ok(json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ArraySize, CellValue, Pos,
        a1::A1Selection,
        controller::GridController,
        grid::{
            CodeCellLanguage, CodeCellValue,
            sheet::borders::{BorderSelection, BorderStyle},
        },
    };
    use bigdecimal::BigDecimal;

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
    const V1_5_JAVASCRIPT_GETTING_STARTED_EXAMPLE: &[u8] = include_bytes!(
        "../../../../quadratic-rust-shared/data/grid/v1_5_JavaScript_getting_started_(example).grid"
    );

    #[test]
    fn process_a_number_v1_3_file() {
        let imported = import(V1_3_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let exported_test = import_binary(exported).unwrap();
        assert_eq!(imported, exported_test);
    }

    #[test]
    fn process_a_v1_3_file() {
        let imported = import(V1_3_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let exported_test = import_binary(exported).unwrap();
        assert_eq!(imported, exported_test);
    }

    #[test]
    fn process_a_v1_3_python_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_3_PYTHON_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        assert_eq!(imported, import_binary(exported).unwrap());
    }

    #[test]
    fn process_a_v1_3_python_text_only_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_3_TEXT_ONLY_CODE_CELL_FILE.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_single_formula_file() {
        let imported = import(V1_3_SINGLE_FORMULAS_CODE_CELL_FILE.to_vec()).unwrap();
        assert!(
            imported.sheets[0]
                .data_tables
                .get(&Pos { x: 1, y: 3 })
                .is_some()
        );
        let a1_context = imported.make_a1_context();
        let code_cell = imported.sheets[0]
            .edit_code_value(Pos { x: 1, y: 3 }, &a1_context)
            .unwrap();

        match code_cell.language {
            CodeCellLanguage::Formula => {
                assert_eq!(code_cell.code_string, "SUM(A1:A2)");
            }
            _ => panic!("Expected a formula"),
        };
        let _exported = export(imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_npm_downloads_file() {
        let imported = import(V1_3_NPM_DOWNLOADS_FILE.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    fn process_a_v1_4_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let imported = import(V1_4_FILE.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
    }

    #[test]
    fn process_a_blank_v1_4_file() {
        let empty =
            r#"{"sheets":[{"name":"Sheet1","id":{"id":"4b42eacf-5737-47a2-ac44-e4929d3abc3a"},"order":"a0","cells":[],"code_cells":[],"formats":[],"columns":[],"rows":[],"offsets":[[],[]],"borders":{}}],"version":"1.4"}"#.as_bytes();
        let imported = import(empty.to_vec()).unwrap();
        let _exported = export(imported).unwrap();
    }

    #[test]
    fn process_a_v1_3_borders_file() {
        let imported = import(V1_3_BORDERS_FILE.to_vec()).unwrap();
        // println!("{:?}", imported.sheets[0].borders);
        let _exported = export(imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    fn process_a_simple_v1_4_borders_file() {
        let empty = r##"{"sheets":[{"id":{"id":"d48a3488-fb1d-438d-ba0b-d4ad81b8c239"},"name":"Sheet1","color":null,"order":"a0","offsets":[[],[]],"columns":[[0,{"id":{"id":"6287d0f0-b559-4de2-a73f-5b140237b3c4"},"values":{"0":{"y":0,"content":{"Values":[{"type":"text","value":"a"}]}}},"spills":{},"align":{},"wrap":{},"numeric_format":{},"numeric_decimals":{},"numeric_commas":{},"bold":{},"italic":{},"text_color":{},"fill_color":{}}]],"rows":[[0,{"id":"a9ed07c9-98af-453d-9b5e-311c48be42f7"}]],"borders":{"6287d0f0-b559-4de2-a73f-5b140237b3c4":[[0,[{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"},{"color":"#000000ff","line":"line1"}]]]},"code_cells":[]}],"version":"1.4"}"##.as_bytes();
        let imported = import(empty.to_vec()).unwrap();
        // println!("{:#?}", imported.sheets()[0].borders);
        let _exported = export(imported).unwrap();
        // println!("{}", _exported);
    }

    #[test]
    fn process_a_v1_4_airports_distance_file() {
        let imported = import(V1_4_AIRPORTS_DISTANCE_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported, imported_copy);
    }

    #[test]
    fn imports_and_exports_v1_4_default() {
        let imported = import(V1_4_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    fn imports_and_exports_a_v1_5_grid() {
        let imported = import(V1_5_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    fn imports_and_exports_a_v1_6_grid() {
        let imported = import(V1_6_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    fn imports_and_exports_v1_5_qawolf_test_file() {
        import(V1_5_QAWOLF_TEST_FILE.to_vec()).unwrap();

        // this won't work because of the offsets shift
        // let exported = export(imported.clone()).unwrap();
        // let imported_copy = import(exported).unwrap();
        // assert_eq!(imported_copy, imported);
    }

    #[test]
    fn imports_and_exports_v1_5_update_code_runs_file() {
        let imported = import(V1_5_UPGRADE_CODE_RUNS.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    fn imports_and_exports_v1_5_javascript_getting_started_example() {
        let imported = import(V1_5_JAVASCRIPT_GETTING_STARTED_EXAMPLE.to_vec()).unwrap();

        // this won't work because of the offsets shift
        // let exported = export(imported.clone()).unwrap();
        // let imported_copy = import(exported).unwrap();
        // assert_eq!(imported_copy, imported);

        let sheet = &imported.sheets[0];
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }).unwrap(),
            CellValue::Text("JavaScript examples".into())
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 4 }).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "let result = [];\nfor (let i = 0; i < 500; i++) {\n    result.push(2 ** i);\n}\nreturn result;".to_string(),
            })
        );
        assert_eq!(
            sheet
                .data_tables
                .get(&Pos { x: 1, y: 4 })
                .unwrap()
                .output_size(),
            ArraySize::new(1, 500).unwrap()
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 3, y: 7 }).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "// fix by putting a let statement in front of x \nx = 5; ".to_string(),
            })
        );
        assert_eq!(sheet.data_tables.len(), 10);
        assert_eq!(
            sheet
                .data_tables
                .get(&Pos { x: 3, y: 7 })
                .unwrap()
                .code_run()
                .unwrap()
                .std_err,
            Some("x is not defined".into())
        );
    }

    #[test]
    fn test_code_cell_references_migration_to_q_cells_for_v_1_7_1() {
        let file = include_bytes!("../../../test-files/test_getCells_migration.grid");
        let imported = import(file.to_vec()).unwrap();
        let sheet1 = &imported.sheets[0];
        let sheet2 = &imported.sheets[1];
        assert_eq!(
            sheet1.cell_value(pos![A1]).unwrap(),
            CellValue::Number(BigDecimal::from(1))
        );
        assert_eq!(
            sheet1.cell_value(pos![F6]).unwrap(),
            CellValue::Number(BigDecimal::from(1))
        );
        assert_eq!(
            sheet2.cell_value(pos![A1]).unwrap(),
            CellValue::Number(BigDecimal::from(100))
        );
        assert_eq!(
            sheet2.cell_value(pos![D5]).unwrap(),
            CellValue::Number(BigDecimal::from(100))
        );

        assert_eq!(
            sheet1.cell_value(pos![I10]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"F6\") + q.cells(\"\'Sheet 2\'!D5\")".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![I11]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"F6\") + q.cells(\"\'Sheet 2\'!D5\")".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![I12]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"A1:A14\", first_row_header=False)".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![I26]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"\'Sheet 2\'!A1:A22\", first_row_header=False)".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![I48]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"F6\") + q.cells(\"\'Sheet 2\'!D5\")".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![I49]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"A1:A14\", first_row_header=False)".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![I63]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"\'Sheet 2\'!A1:A22\", first_row_header=False)".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![K10]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"I10\")".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![K11]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"I11\")".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![K12]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"A1:A14\")".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![K28]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "q.cells(\"F6\") + q.cells(\"\'Sheet 2\'!D5\") + cell(-12, -12) + cell(-86, -85, sheet=\"Sheet 2\")".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![M10]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"F6\") + q.cells(\"\'Sheet 2\'!D5\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![M11]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"F6\") + q.cells(\"\'Sheet 2\'!D5\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![M12]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"A1:A14\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![M26]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"\'Sheet 2\'!A1:A22\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![M48]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"F6\") + q.cells(\"\'Sheet 2\'!D5\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![M49]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"A1:A14\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![M63]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"\'Sheet 2\'!A1:A22\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![O10]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"M10\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![O11]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"M11\");".to_string(),
            })
        );

        assert_eq!(
            sheet1.cell_value(pos![O12]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "return q.cells(\"A1:A14\");".to_string(),
            })
        );
    }

    #[test]
    fn process_a_v1_7_1_borders_file() {
        let mut gc = GridController::test();

        gc.set_borders(
            A1Selection::test_a1("A1:J10"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let exported = export(gc.grid().clone()).unwrap();
        let imported = import(exported).unwrap();
        assert_eq!(imported, gc.grid().clone());
    }

    #[test]
    fn test_new_file() {
        const NEW_FILE: &[u8] =
            include_bytes!("../../../../quadratic-api/src/data/current_blank.grid");

        let imported = import(NEW_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let exported_test = import_binary(exported).unwrap();
        assert_eq!(imported, exported_test);
    }
}
