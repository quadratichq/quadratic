use std::collections::HashMap;
use std::str::FromStr;

use crate::grid::file::v1_4::schema as v1_4;
use crate::grid::file::v1_5::schema::{self as v1_5, CellAlign, ColumnRepeat};
use anyhow::Result;
use chrono::DateTime;

fn convert_column_values(
    from: &HashMap<String, v1_4::ColumnValues>,
) -> HashMap<String, v1_5::CellValue> {
    from.iter()
        .map(|(k, v)| {
            let v1_4::ColumnValue { type_field, value } = &v.content.values[0];
            let value = match type_field.to_lowercase().as_str() {
                "text" => v1_5::CellValue::Text(value.clone()),
                "number" => v1_5::CellValue::Number(value.clone()),
                _ => panic!("Unknown type_field: {}", type_field),
            };
            (k.clone(), value)
        })
        .collect()
}

fn upgrade_column(sheet: &v1_4::Sheet, x: &i64, column: &v1_4::Column) -> (i64, v1_5::Column) {
    let mut values = convert_column_values(&column.values);

    // add CellValue::Formula/Python to v1_5::Column.values
    sheet
        .code_cells
        .iter()
        .for_each(|(cell_ref, code_cell_value)| {
            if cell_ref.column == column.id {
                let pos = cell_ref_to_pos(sheet, cell_ref);
                let language = match code_cell_value.language.to_lowercase().as_str() {
                    "python" => Some(v1_5::CodeCellLanguage::Python),
                    "formula" => Some(v1_5::CodeCellLanguage::Formula),
                    _ => Some(v1_5::CodeCellLanguage::Formula), // this should not happen
                };
                if let Some(language) = language {
                    values.insert(
                        pos.y.to_string(),
                        v1_5::CellValue::Code(v1_5::CodeCell {
                            code: code_cell_value.code_string.clone(),
                            language,
                        }),
                    );
                }
            }
        });

    (
        *x,
        v1_5::Column {
            values,
            align: column
                .align
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: match v.content.value.as_str() {
                            "left" => CellAlign::Left,
                            "center" => CellAlign::Center,
                            "right" => CellAlign::Right,
                            _ => CellAlign::Left, // this should not happen
                        },
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            wrap: column
                .wrap
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: match v.content.value.to_lowercase().as_str() {
                            "overflow" => v1_5::CellWrap::Overflow,
                            "wrap" => v1_5::CellWrap::Wrap,
                            "clip" => v1_5::CellWrap::Clip,
                            _ => v1_5::CellWrap::Overflow, // this should not happen
                        },
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            numeric_format: column
                .numeric_format
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v1_5::NumericFormat {
                            kind: match v.content.value.kind.to_lowercase().as_str() {
                                "number" => v1_5::NumericFormatKind::Number,
                                "percentage" => v1_5::NumericFormatKind::Percentage,
                                "currency" => v1_5::NumericFormatKind::Currency,
                                "exponential" => v1_5::NumericFormatKind::Exponential,
                                _ => v1_5::NumericFormatKind::Number, // this should not happen
                            },
                            symbol: v.content.value.symbol.clone(),
                        },
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            numeric_decimals: column
                .numeric_decimals
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v.content.value,
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            numeric_commas: column
                .numeric_commas
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v.content.value,
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            bold: column
                .bold
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v.content.value,
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            italic: column
                .italic
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v.content.value,
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            text_color: column
                .text_color
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v.content.value.clone(),
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            fill_color: column
                .fill_color
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v.content.value.clone(),
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
                .collect(),
            render_size: column
                .render_size
                .iter()
                .map(|(k, v)| {
                    let value = ColumnRepeat {
                        value: v1_5::RenderSize {
                            w: v.content.value.w.clone(),
                            h: v.content.value.h.clone(),
                        },
                        len: v.content.len as u32,
                    };
                    (k.clone(), value)
                })
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
            code_cell_value.output.clone().map(|output| {
                let result = match output.result.clone() {
                    v1_4::CodeCellRunResult::Ok { output_value, .. } => {
                        v1_5::CodeRunResult::Ok(match output_value {
                            v1_4::OutputValue::Single(value) => v1_5::OutputValue::Single(value),
                            v1_4::OutputValue::Array(array) => v1_5::OutputValue::Array(array),
                        })
                    }
                    v1_4::CodeCellRunResult::Err { error } => {
                        // note: we never saved the error type in v1_4
                        v1_5::CodeRunResult::Err(v1_5::RunError {
                            span: error.span,
                            msg: v1_5::RunErrorMsg::InternalError(error.msg.into()),
                        })
                    }
                };

                (
                    cell_ref_to_pos(sheet, cell_ref),
                    v1_5::CodeRun {
                        formatted_code_string: code_cell_value.formatted_code_string.clone(),
                        last_modified: Some(
                            DateTime::from_str(&code_cell_value.last_modified).unwrap_or_default(),
                        ),
                        std_out: output.std_out.clone(),
                        std_err: output.std_err.clone(),
                        spill_error: output.spill,
                        cells_accessed: match output.result {
                            v1_4::CodeCellRunResult::Ok { cells_accessed, .. } => cells_accessed
                                .into_iter()
                                .map(|cell_ref| cell_ref_to_sheet_rect(sheet, &cell_ref))
                                .collect(),
                            v1_4::CodeCellRunResult::Err { .. } => vec![],
                        },
                        result,
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
    v1_5::Sheet {
        id: v1_5::Id::from(sheet.id.id.clone()),
        name: sheet.name.clone(),
        color: sheet.color.clone(),
        order: sheet.order.clone(),
        offsets: sheet.offsets.clone(),
        columns: upgrade_columns(sheet),
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
        let _ = export(&imported).unwrap();
    }
}
