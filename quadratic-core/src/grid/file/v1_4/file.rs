use std::collections::HashMap;

use crate::grid::file::v1_4::schema as v1_4;
use crate::grid::file::v1_5::schema::{self as v1_5};
use anyhow::Result;

// todo: use Result instead of panicking

fn upgrade_spills(
    sheet: &v1_4::Sheet,
    spills: &HashMap<String, v1_4::ColumnFormatType<String>>,
) -> HashMap<String, v1_5::ColumnFormatType<String>> {
    spills
        .iter()
        .map(|(_, spill)| {
            let y = spill.y;
            let cell_ref = serde_json::from_str::<v1_4::CellRef>(&spill.content.value).unwrap();
            let len = spill.content.len;
            let sheet_pos_string = serde_json::to_string(&cell_ref_to_sheet_pos(sheet, &cell_ref))
                .ok()
                .unwrap();
            (
                y.to_string(),
                v1_5::ColumnFormatType::<String> {
                    y,
                    content: v1_5::ColumnFormatContent {
                        value: sheet_pos_string,
                        len,
                    },
                },
            )
        })
        .collect()
}

fn upgrade_column(sheet: &v1_4::Sheet, x: &i64, column: &v1_4::Column) -> (i64, v1_5::Column) {
    (
        *x,
        v1_5::Column {
            values: column.values.clone(),
            spills: upgrade_spills(sheet, &column.spills),
            align: column.align.clone(),
            wrap: column.wrap.clone(),
            numeric_format: column.numeric_format.clone(),
            numeric_decimals: column.numeric_decimals.clone(),
            numeric_commas: column.numeric_commas.clone(),
            bold: column.bold.clone(),
            italic: column.italic.clone(),
            text_color: column.text_color.clone(),
            fill_color: column.fill_color.clone(),
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

fn cell_ref_to_sheet_pos(sheet: &v1_4::Sheet, cell_ref: &v1_4::CellRef) -> v1_5::SheetPos {
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
    v1_5::SheetPos {
        x,
        y,
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

fn upgrade_code_cells(sheet: &v1_4::Sheet) -> Vec<(v1_5::Pos, v1_5::CodeCellValue)> {
    sheet
        .code_cells
        .clone()
        .into_iter()
        .map(|(cell_ref, code_cell_value)| {
            let pos = cell_ref_to_pos(sheet, &cell_ref);
            (
                pos,
                v1_5::CodeCellValue {
                    language: code_cell_value.language,
                    code_string: code_cell_value.code_string,
                    formatted_code_string: code_cell_value.formatted_code_string,
                    last_modified: code_cell_value.last_modified,
                    output: code_cell_value
                        .output
                        .map(|output| v1_5::CodeCellRunOutput {
                            std_out: output.std_out,
                            std_err: output.std_err,
                            result: match output.result {
                                v1_4::CodeCellRunResult::Ok {
                                    output_value,
                                    cells_accessed,
                                } => v1_5::CodeCellRunResult::Ok {
                                    output_value: match output_value {
                                        v1_4::OutputValue::Single(value) => {
                                            v1_5::OutputValue::Single(value)
                                        }
                                        v1_4::OutputValue::Array(array) => {
                                            v1_5::OutputValue::Array(array)
                                        }
                                    },
                                    cells_accessed: cells_accessed
                                        .into_iter()
                                        .map(|cell_ref| cell_ref_to_sheet_pos(sheet, &cell_ref))
                                        .collect(),
                                },
                                v1_4::CodeCellRunResult::Err { error } => {
                                    v1_5::CodeCellRunResult::Err { error }
                                }
                            },
                        }),
                },
            )
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
        code_cells: upgrade_code_cells(sheet),
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

    const V1_4_FILE: &str = include_str!("../../../../examples/v1_4_simple.grid");

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
