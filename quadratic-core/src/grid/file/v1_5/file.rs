use crate::grid::file::v1_5::schema as v1_5;
use crate::grid::file::v1_6::schema as v1_6;
use crate::grid::file::v1_6::schema_validation::Validations;
use anyhow::Result;

fn upgrade_column(x: &i64, column: &v1_5::Column) -> (i64, v1_6::Column) {
    (
        *x,
        v1_6::Column {
            values: column
                .values
                .iter()
                .map(|(k, v)| {
                    (
                        k.into(),
                        match &v {
                            v1_5::CellValue::Text(value) => v1_6::CellValue::Text(value.clone()),
                            v1_5::CellValue::Number(value) => {
                                v1_6::CellValue::Number(value.to_owned())
                            }
                            v1_5::CellValue::Html(value) => v1_6::CellValue::Html(value.clone()),
                            v1_5::CellValue::Blank => v1_6::CellValue::Blank,
                            v1_5::CellValue::Code(code_cell) => {
                                v1_6::CellValue::Code(v1_6::CodeCell {
                                    language: match &code_cell.language {
                                        v1_5::CodeCellLanguage::Python => {
                                            v1_6::CodeCellLanguage::Python
                                        }
                                        v1_5::CodeCellLanguage::Formula => {
                                            v1_6::CodeCellLanguage::Formula
                                        }
                                        v1_5::CodeCellLanguage::Javascript => {
                                            v1_6::CodeCellLanguage::Python
                                        }
                                        v1_5::CodeCellLanguage::Connection { kind, ref id } => {
                                            v1_6::CodeCellLanguage::Connection {
                                                kind: match kind {
                                                    v1_5::ConnectionKind::Postgres => {
                                                        v1_6::ConnectionKind::Postgres
                                                    }
                                                    v1_5::ConnectionKind::Mysql => {
                                                        v1_6::ConnectionKind::Mysql
                                                    }
                                                },
                                                id: id.clone(),
                                            }
                                        }
                                    },
                                    code: code_cell.code.clone(),
                                })
                            }
                            v1_5::CellValue::Logical(value) => v1_6::CellValue::Logical(*value),
                            v1_5::CellValue::Error(value) => v1_6::CellValue::Error(value.clone()),
                            v1_5::CellValue::Duration(value) => {
                                v1_6::CellValue::Duration(value.clone())
                            }
                            v1_5::CellValue::Instant(value) => {
                                v1_6::CellValue::Instant(value.clone())
                            }
                            v1_5::CellValue::Image(value) => v1_6::CellValue::Text(value.clone()),
                        },
                    )
                })
                .collect(),
            vertical_align: column
                .vertical_align
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: match v.value {
                                v1_5::CellVerticalAlign::Top => v1_6::CellVerticalAlign::Top,
                                v1_5::CellVerticalAlign::Middle => v1_6::CellVerticalAlign::Middle,
                                v1_5::CellVerticalAlign::Bottom => v1_6::CellVerticalAlign::Bottom,
                            },
                            len: v.len,
                        },
                    )
                })
                .collect(),
            align: column
                .align
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: match v.value {
                                v1_5::CellAlign::Left => v1_6::CellAlign::Left,
                                v1_5::CellAlign::Center => v1_6::CellAlign::Center,
                                v1_5::CellAlign::Right => v1_6::CellAlign::Right,
                            },
                            len: v.len,
                        },
                    )
                })
                .collect(),
            wrap: column
                .wrap
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: match v.value {
                                v1_5::CellWrap::Wrap => v1_6::CellWrap::Wrap,
                                v1_5::CellWrap::Overflow => v1_6::CellWrap::Overflow,
                                v1_5::CellWrap::Clip => v1_6::CellWrap::Clip,
                            },
                            len: v.len,
                        },
                    )
                })
                .collect(),
            numeric_format: column
                .numeric_format
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v1_6::NumericFormat {
                                kind: match v.value.kind {
                                    v1_5::NumericFormatKind::Number => {
                                        v1_6::NumericFormatKind::Number
                                    }
                                    v1_5::NumericFormatKind::Currency => {
                                        v1_6::NumericFormatKind::Currency
                                    }
                                    v1_5::NumericFormatKind::Percentage => {
                                        v1_6::NumericFormatKind::Percentage
                                    }
                                    v1_5::NumericFormatKind::Exponential => {
                                        v1_6::NumericFormatKind::Exponential
                                    }
                                },
                                symbol: v.value.symbol.clone(),
                            },
                            len: v.len,
                        },
                    )
                })
                .collect(),
            numeric_decimals: column
                .numeric_decimals
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            numeric_commas: column
                .numeric_commas
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            bold: column
                .bold
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            italic: column
                .italic
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            text_color: column
                .text_color
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v.value.clone(),
                            len: v.len,
                        },
                    )
                })
                .collect(),
            fill_color: column
                .fill_color
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v.value.clone(),
                            len: v.len,
                        },
                    )
                })
                .collect(),
            render_size: column
                .render_size
                .iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        v1_6::ColumnRepeat {
                            value: v1_6::RenderSize {
                                w: v.value.w.clone(),
                                h: v.value.h.clone(),
                            },
                            len: v.len,
                        },
                    )
                })
                .collect(),
        },
    )
}

fn upgrade_columns(sheet: &v1_5::Sheet) -> Vec<(i64, v1_6::Column)> {
    sheet
        .columns
        .iter()
        .map(|(x, column)| upgrade_column(x, column))
        .collect()
}

fn upgrade_code_runs(sheet: &v1_5::Sheet) -> Vec<(v1_6::Pos, v1_6::CodeRun)> {
    sheet
        .code_runs
        .iter()
        .map(|(pos, old_code_run)| {
            (
                v1_6::Pos { x: pos.x, y: pos.y },
                v1_6::CodeRun {
                    formatted_code_string: old_code_run.formatted_code_string.clone(),
                    last_modified: old_code_run.last_modified,
                    std_err: old_code_run.std_err.clone(),
                    std_out: old_code_run.std_out.clone(),
                    spill_error: old_code_run.spill_error,
                    cells_accessed: old_code_run.cells_accessed.clone(),
                    return_type: old_code_run.return_type.clone(),
                    line_number: old_code_run.line_number,
                    output_type: old_code_run.output_type.clone(),
                    result: match &old_code_run.result {
                        v1_5::CodeRunResult::Ok(output_value) => {
                            v1_6::CodeRunResult::Ok(match output_value {
                                v1_5::OutputValue::Single(value) => {
                                    if value.type_field.to_lowercase() == "text" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Text(
                                            value.value.to_owned(),
                                        ))
                                    } else if value.type_field.to_lowercase() == "number" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Number(
                                            value.value.to_owned(),
                                        ))
                                    } else if value.type_field.to_lowercase() == "logical" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Logical(
                                            v1_5::string_bool(&value.value),
                                        ))
                                    } else if value.type_field.to_lowercase() == "html" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Html(
                                            value.value.to_owned(),
                                        ))
                                    } else if value.type_field.to_lowercase() == "blank" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Blank)
                                    } else {
                                        dbgjs!(format!("Unknown type_field: {}", value.type_field));
                                        panic!("Unknown type_field: {}", value.type_field)
                                    }
                                }
                                v1_5::OutputValue::Array(array) => {
                                    v1_6::OutputValue::Array(v1_6::OutputArray {
                                        values: array
                                            .values
                                            .iter()
                                            .map(|value| {
                                                if value.type_field.to_lowercase().as_str()
                                                    == "text"
                                                {
                                                    v1_6::CellValue::Text(value.value.to_owned())
                                                } else if value.type_field.to_lowercase().as_str()
                                                    == "number"
                                                {
                                                    v1_6::CellValue::Number(value.value.to_owned())
                                                } else if value.type_field.to_lowercase()
                                                    == "logical"
                                                {
                                                    v1_6::CellValue::Logical(v1_5::string_bool(
                                                        &value.value,
                                                    ))
                                                } else if value.type_field.to_lowercase() == "html"
                                                {
                                                    v1_6::CellValue::Html(value.value.to_owned())
                                                } else if value.type_field.to_lowercase() == "blank"
                                                {
                                                    v1_6::CellValue::Blank
                                                } else {
                                                    dbgjs!(format!(
                                                        "Unknown type_field: {}",
                                                        value.type_field
                                                    ));
                                                    panic!(
                                                        "Unknown type_field: {}",
                                                        value.type_field
                                                    )
                                                }
                                            })
                                            .collect(),
                                        size: v1_6::OutputSize {
                                            w: array.size.w,
                                            h: array.size.h,
                                        },
                                    })
                                }
                            })
                        }
                        v1_5::CodeRunResult::Err(error) => {
                            v1_6::CodeRunResult::Err(v1_6::RunError {
                                span: error.span.clone(),
                                msg: error.msg.clone(),
                            })
                        }
                    },
                },
            )
        })
        .collect()
}

fn upgrade_borders(sheet: &v1_5::Sheet) -> v1_6::Borders {
    sheet
        .borders
        .iter()
        .map(|(x, borders)| (x.clone(), borders.clone()))
        .collect()
}

fn upgrade_sheet(sheet: &v1_5::Sheet) -> v1_6::Sheet {
    v1_6::Sheet {
        id: v1_6::Id::from(sheet.id.id.clone()),
        name: sheet.name.clone(),
        color: sheet.color.clone(),
        order: sheet.order.clone(),
        offsets: sheet.offsets.clone(),
        columns: upgrade_columns(sheet),
        borders: upgrade_borders(sheet),
        code_runs: upgrade_code_runs(sheet),
        formats_all: None,
        formats_columns: vec![],
        formats_rows: vec![],
        rows_resize: vec![],
        validations: Validations::default(),
    }
}

pub(crate) fn upgrade(schema: v1_5::GridSchema) -> Result<v1_6::GridSchema> {
    let schema = v1_6::GridSchema {
        version: Some("1.6".into()),
        sheets: schema.sheets.iter().map(upgrade_sheet).collect(),
    };
    Ok(schema)
}

#[cfg(test)]
mod tests {
    use crate::grid::file::v1_5::schema::GridSchema;
    use anyhow::{anyhow, Result};
    use serial_test::parallel;

    const V1_5_FILE: &str =
        include_str!("../../../../../quadratic-rust-shared/data/grid/v1_5_simple.grid");

    fn import(file_contents: &str) -> Result<GridSchema> {
        serde_json::from_str::<GridSchema>(file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        serde_json::to_string(grid_schema).map_err(|e| anyhow!("Could not export file: {:?}", e))
    }

    #[test]
    #[parallel]
    fn import_and_export_a_v1_5_file() {
        let imported = import(V1_5_FILE).unwrap();
        let _ = export(&imported).unwrap();
    }
}
