use crate::{CellValue, Error, ErrorMsg, Span, Value};

use super::{
    sheet::sheet_offsets::SheetOffsets, CellRef, CodeCellLanguage, CodeCellRunOutput,
    CodeCellRunResult, CodeCellValue, Column, ColumnId, IdMap, RowId, SheetBorders, SheetId,
};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, str::FromStr};

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
    v1_5_new {
        #[serde(flatten)]
        grid: v1_5_new::GridSchema,
    },

    // #[serde(rename = "1.4")]
    // V1_4 {
    //     #[serde(flatten)]
    //     grid: v1_4::GridSchemaV1_4,
    // },
    #[serde(rename = "1.3")]
    v1_3 {
        #[serde(flatten)]
        grid: v1_3_schema::GridSchema,
    },
}
impl GridFile {
    fn into_latest(self) -> Result<v1_5_new::GridSchema> {
        match self {
            GridFile::v1_5_new { grid } => Ok(grid),
            // GridFile::V1_5 { grid } => Ok(grid),
            // GridFile::V1_4 { grid } => grid.into_v1_5(),
            GridFile::v1_3 { grid } => v1_3::upgrade(v1_3::import(&grid.version).unwrap()),
        }
    }
}

pub fn import(file_contents: &str) -> Result<current::Grid> {
    let file = v1_5_new::import(file_contents)?;

    // let file = serde_json::from_str::<GridFile>(file_contents)
    //     .map_err(|e| anyhow!(e))?
    //     .into_latest()?;

    Ok(current::Grid {
        sheets: file
            .sheets
            .into_iter()
            .map(|sheet| {
                let mut sheet = current::Sheet {
                    id: SheetId::from_str(&sheet.id.id).unwrap(),
                    name: sheet.name,
                    color: sheet.color,
                    order: sheet.order,
                    column_ids: sheet
                        .columns
                        .clone()
                        .into_iter()
                        .map(|(x, column)| (x, ColumnId::from_str(&column.id.id).unwrap()))
                        .collect(),
                    row_ids: sheet
                        .rows
                        .into_iter()
                        .map(|(x, row)| (x, RowId::from_str(&row.id).unwrap()))
                        .collect(),
                    offsets: SheetOffsets::import(sheet.offsets),
                    columns: sheet
                        .columns
                        .into_iter()
                        .map(|(x, column)| {
                            (
                                x,
                                Column {
                                    id: ColumnId::from_str(&column.id.id).unwrap(),
                                    // values: column.values.into(),
                                    ..Default::default()
                                },
                            )
                        })
                        .collect(),
                    // borders: sheet.borders,
                    borders: SheetBorders::new(),
                    code_cells: sheet
                        .code_cells
                        .into_iter()
                        .map(|(cell_ref, code_cell_value)| {
                            (
                                CellRef {
                                    sheet: SheetId::from_str(&cell_ref.sheet.id).unwrap(),
                                    column: ColumnId::from_str(&cell_ref.column.id).unwrap(),
                                    row: RowId::from_str(&cell_ref.row.id).unwrap(),
                                },
                                CodeCellValue {
                                    language: CodeCellLanguage::from_str(&code_cell_value.language)
                                        .unwrap(),
                                    code_string: code_cell_value.code_string,
                                    formatted_code_string: code_cell_value.formatted_code_string,
                                    last_modified: code_cell_value.last_modified,
                                    output: code_cell_value.output.and_then(|output| {
                                        Some(CodeCellRunOutput {
                                            std_out: output.std_out,
                                            std_err: output.std_err,
                                            result: match output.result {
                                                v1_5_new::CodeCellRunResult::Ok {
                                                    output_value,
                                                    cells_accessed,
                                                } => CodeCellRunResult::Ok {
                                                    // TODO(ddimaria): implement Value::Array()
                                                    // TODO(ddimaria): implent
                                                    output_value: Value::Single(CellValue::Text(
                                                        "".into(),
                                                    )),
                                                    // output_value: Value::Single(match output_value
                                                    //     .type_field
                                                    //     .to_lowercase()
                                                    //     .as_str()
                                                    // {
                                                    //     // TODO(ddimaria): implent for the rest of the types
                                                    //     "text" => {
                                                    //         CellValue::Text(output_value.value)
                                                    //     }
                                                    //     _ => unimplemented!(),
                                                    // }),
                                                    cells_accessed: cells_accessed
                                                        .into_iter()
                                                        .map(|cell| CellRef {
                                                            sheet: SheetId::from_str(
                                                                &cell.sheet.id,
                                                            )
                                                            .unwrap(),
                                                            column: ColumnId::from_str(
                                                                &cell.column.id,
                                                            )
                                                            .unwrap(),
                                                            row: RowId::from_str(&cell.row.id)
                                                                .unwrap(),
                                                        })
                                                        .collect(),
                                                },
                                                v1_5_new::CodeCellRunResult::Err { error } => {
                                                    CodeCellRunResult::Err {
                                                        error: Error {
                                                            span: error.span.and_then(|span| {
                                                                Some(Span {
                                                                    start: span.start,
                                                                    end: span.end,
                                                                })
                                                            }),
                                                            // TODO(ddimaria): implement ErrorMsg
                                                            msg: ErrorMsg::UnknownError,
                                                        },
                                                    }
                                                }
                                            },
                                        })
                                    }),
                                },
                            )
                        })
                        .collect(),
                    data_bounds: current::GridBounds::Empty,
                    format_bounds: current::GridBounds::Empty,
                };
                sheet.recalculate_bounds();
                sheet
            })
            .collect(),
        // dependencies: file.dependencies.into_iter().collect(),
        dependencies: HashMap::new(),
    })
}

pub fn version() -> String {
    String::from("1.5")
}

pub fn export(grid: &current::Grid) -> Result<String, String> {
    Ok("".into())
    // serde_json::to_string(&GridFile::v1_5_new {
    //     grid: v1_5_new::GridSchema {
    //         version: version(),
    //         sheets: grid
    //             .sheets()
    //             .into_iter()
    //             .map(|sheet| v1_5_new::Sheet {
    //                 id: v1_5_new::Id {
    //                     id: sheet.id.to_string(),
    //                 },
    //                 name: sheet.name.clone(),
    //                 color: sheet.color.clone(),
    //                 order: sheet.order.clone(),
    //                 offsets: sheet.offsets.export(),
    //                 columns: sheet
    //                     .iter_columns()
    //                     .map(|(x, column)| (x, column.clone()))
    //                     .collect(),
    //                 rows: sheet.iter_rows().collect(),
    //                 borders: sheet.borders().clone(), // TODO: serialize borders
    //                 code_cells: sheet
    //                     .iter_code_cells_locations()
    //                     .filter_map(|cell_ref| {
    //                         Some((cell_ref, sheet.get_code_cell_from_ref(cell_ref)?.clone()))
    //                     })
    //                     .collect(),
    //             })
    //             .collect(),
    //         dependencies: grid.dependencies.clone().into_iter().collect(),
    //     },
    // })
    // .map_err(|e| e.to_string())
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

    #[test]
    fn imports_and_exports_a_v1_5_grid() {
        // let mut grid_controller = GridController::new();
        // let sheet_id = grid_controller.grid().sheets()[0].id;
        // let pos = Pos { x: 0, y: 0 };
        // let range = Rect::new_span(pos, Pos { x: 3, y: 10 });

        // grid_controller
        //     .import_csv(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos, None)
        //     .await
        //     .unwrap();

        // grid_controller
        //     .set_cell_bold(sheet_id, range, Some(true), None)
        //     .await;

        // let exported = export(grid_controller.grid_mut()).unwrap();

        let imported = import(V1_5_FILE).unwrap();
        println!("{:?}", imported);

        // print_table(
        //     &grid_controller,
        //     sheet_id,
        //     Rect::new_span(pos, Pos { x: 3, y: 10 }),
        // );
    }
}
