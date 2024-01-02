use std::collections::HashMap;
use std::str::FromStr;

use crate::grid::file::v1_4::schema as v1_4;
use crate::grid::file::v1_5::schema as v1_5;
use anyhow::Result;
use chrono::DateTime;

fn convert_column_values(
    from: &HashMap<String, v1_4::ColumnValues>,
) -> HashMap<i64, v1_5::CellValue> {
    from.into_iter()
        .map(|(k, v)| {
            let value = match &v.content.values[0] {
                v1_4::ColumnValue { type_field, value } => match type_field.as_str() {
                    "Text" => v1_5::CellValue::Text(value.clone()),
                    "Number" => v1_5::CellValue::Number(value.clone()),
                    _ => panic!("Unknown type_field: {}", type_field),
                },
            };
            (i64::from_str(&k).unwrap(), value)
        })
        .collect()
}

fn upgrade_column(sheet: &v1_4::Sheet, x: &i64, column: &v1_4::Column) -> (i64, v1_5::Column) {
    // need to add CellValue::Formula/Python to v1_5::Column.values
    let code_values = sheet
        .code_cells
        .iter()
        .filter_map(|(cell_ref, code_cell_value)| {
            if cell_ref.column == column.id {
                let pos = cell_ref_to_pos(sheet, cell_ref);
                Some((pos.y, code_cell_value.language, code_cell_value.code_string))
            } else {
                None
            }
        });
    let mut values = convert_column_values(&column.values);
    for (y, language, code) in code_values {
        if let Ok(value) = serde_json::to_string(&v1_5::CodeCell { language, code }) {
            let language = if language == "python" {
                Some(v1_5::CodeCellLanguage::Python)
            } else if language == "formula" {
                Some(v1_5::CodeCellLanguage::Formula)
            } else {
                None
            };
            values.insert(y, v1_5::CellValue::Code(v1_5::CodeCell { code, language }));
        }
    }
    (
        *x,
        v1_5::Column {
            values,
            align: column
                .align
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            wrap: column
                .wrap
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            numeric_format: column
                .numeric_format
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            numeric_decimals: column
                .numeric_decimals
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            numeric_commas: column
                .numeric_commas
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            bold: column
                .bold
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            italic: column
                .italic
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            text_color: column
                .text_color
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            fill_color: column
                .fill_color
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
            render_size: column
                .render_size
                .iter()
                .map(|(k, v)| (i64::from_str(&k).unwrap(), v.clone()))
                .collect(),
        },
    )
}

fn upgrade_columns(sheet: &v1_4::Sheet) -> Vec<(i64, v1_5::Column)> {
    sheet
        .columns
        .iter()
        .map(|(x, column)| upgrade_column(sheet, x, column))
        .collect()
}

fn cell_ref_to_sheet_rect(sheet: &v1_4::Sheet, cell_ref: &v1_4::CellRef) -> v1_5::SheetRect {
    let x = sheet
        .columns
        .iter()
        .find(|column| column.1.id == cell_ref.column)
        .unwrap()
        .0;
    let y = sheet
        .rows
        .iter()
        .find(|row| row.1 == cell_ref.row)
        .unwrap()
        .0;
    v1_5::SheetRect {
        min: v1_5::Pos { x, y },
        max: v1_5::Pos { x, y },
        sheet_id: v1_5::Id::from(cell_ref.sheet.id.clone()),
    }
}

fn cell_ref_to_pos(sheet: &v1_4::Sheet, cell_ref: &v1_4::CellRef) -> v1_5::Pos {
    let x = sheet
        .columns
        .iter()
        .find(|column| column.1.id == cell_ref.column)
        .unwrap()
        .0;
    let y = sheet
        .rows
        .iter()
        .find(|row| row.1 == cell_ref.row)
        .unwrap()
        .0;
    v1_5::Pos { x, y }
}

fn column_id_to_x(sheet: &v1_4::Sheet, column_id: &String) -> i64 {
    sheet
        .columns
        .iter()
        .find(|column| column.1.id.id == *column_id)
        .unwrap()
        .0
}

fn upgrade_code_runs(sheet: &v1_4::Sheet) -> Vec<(v1_5::Pos, v1_5::CodeRun)> {
    sheet
        .code_cells
        .iter()
        .filter_map(|(cell_ref, code_cell_value)| {
            code_cell_value.output.map(|output| {
                (
                    cell_ref_to_pos(sheet, &cell_ref),
                    v1_5::CodeRun {
                        formatted_code_string: code_cell_value.formatted_code_string,
                        last_modified: Some(
                            DateTime::from_str(&code_cell_value.last_modified).unwrap_or_default(),
                        ),
                        std_out: output.std_out,
                        std_err: output.std_err,
                        spill_error: output.spill,
                        cells_accessed: match output.result {
                            v1_4::CodeCellRunResult::Ok { cells_accessed, .. } => cells_accessed
                                .into_iter()
                                .map(|cell_ref| cell_ref_to_sheet_rect(sheet, &cell_ref))
                                .collect(),
                            v1_4::CodeCellRunResult::Err { .. } => vec![],
                        },
                        result: match output.result {
                            v1_4::CodeCellRunResult::Ok {
                                output_value,
                                cells_accessed,
                            } => v1_5::CodeRunResult::Ok(match output_value {
                                v1_4::OutputValue::Single(value) => {
                                    v1_5::OutputValue::Single(value)
                                }
                                v1_4::OutputValue::Array(array) => v1_5::OutputValue::Array(array),
                            }),
                            v1_4::CodeCellRunResult::Err { error } => {
                                // note: we never saved the error type in v1_4
                                v1_5::CodeRunResult::Err(v1_5::RunError {
                                    span: error.span,
                                    msg: v1_5::RunErrorMsg::InternalError(error.msg.into()),
                                })
                            }
                        },
                    },
                )
            })
        })
        .collect()
}

fn upgrade_borders(sheet: &v1_4::Sheet) -> v1_5::Borders {
    sheet
        .borders
        .iter()
        .map(|(column_id, borders)| {
            let x = column_id_to_x(sheet, column_id);
            (x.to_string(), borders.clone())
        })
        .collect()
}

fn upgrade_sheet(sheet: &v1_4::Sheet) -> v1_5::Sheet {
    let columns = upgrade_columns(sheet);
    v1_5::Sheet {
        id: v1_5::Id::from(sheet.id.id.clone()),
        name: sheet.name.clone(),
        color: sheet.color.clone(),
        order: sheet.order.clone(),
        offsets: sheet.offsets.clone(),
        columns,
        borders: upgrade_borders(sheet),
        code_runs: upgrade_code_runs(sheet),
    }
}

pub(crate) fn upgrade(schema: v1_4::GridSchema) -> Result<v1_5::GridSchema> {
    let schema = v1_5::GridSchema {
        version: Some("1.5".into()),
        sheets: schema.sheets.iter().map(upgrade_sheet).collect(),
    };
    Ok(schema)
}

#[cfg(test)]
mod tests {
    use crate::grid::file::v1_4::schema::GridSchema;
    use anyhow::{anyhow, Result};

    const V1_4_FILE: &str =
        include_str!("../../../../../quadratic-rust-shared/data/grid/v1_4_simple.grid");

    fn import(file_contents: &str) -> Result<GridSchema> {
        serde_json::from_str::<GridSchema>(file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        serde_json::to_string(grid_schema).map_err(|e| anyhow!("Could not export file: {:?}", e))
    }

    #[test]
    fn import_and_export_a_v1_4_file() {
        let imported = import(V1_4_FILE).unwrap();
        let exported = export(&imported).unwrap();
        println!("{}", exported);
        // assert_eq!(V1_4_FILE, exported);
    }
}
