use std::collections::HashMap;

use anyhow::Result;

use crate::grid::file::v1_5::schema as v1_5;
use crate::grid::file::v1_6::schema as v1_6;
use crate::grid::file::v1_6::schema_validation::Validations;

fn upgrade_column(x: i64, column: v1_5::Column) -> (i64, v1_6::Column) {
    (
        x,
        v1_6::Column {
            values: column
                .values
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        match v {
                            v1_5::CellValue::Text(value) => v1_6::CellValue::Text(value),
                            v1_5::CellValue::Number(value) => v1_6::CellValue::Number(value),
                            v1_5::CellValue::Html(value) => v1_6::CellValue::Html(value),
                            v1_5::CellValue::Blank => v1_6::CellValue::Blank,
                            v1_5::CellValue::Code(code_cell) => {
                                v1_6::CellValue::Code(v1_6::CodeCell {
                                    language: match code_cell.language {
                                        v1_5::CodeCellLanguage::Python => {
                                            v1_6::CodeCellLanguage::Python
                                        }
                                        v1_5::CodeCellLanguage::Formula => {
                                            v1_6::CodeCellLanguage::Formula
                                        }
                                        v1_5::CodeCellLanguage::Javascript => {
                                            v1_6::CodeCellLanguage::Javascript
                                        }
                                        v1_5::CodeCellLanguage::Connection { kind, id } => {
                                            v1_6::CodeCellLanguage::Connection {
                                                kind: match kind {
                                                    v1_5::ConnectionKind::Postgres => {
                                                        v1_6::ConnectionKind::Postgres
                                                    }
                                                    v1_5::ConnectionKind::Mysql => {
                                                        v1_6::ConnectionKind::Mysql
                                                    }
                                                },
                                                id,
                                            }
                                        }
                                    },
                                    code: code_cell.code,
                                })
                            }
                            v1_5::CellValue::Logical(value) => v1_6::CellValue::Logical(value),
                            v1_5::CellValue::Error(value) => v1_6::CellValue::Error(value),
                            v1_5::CellValue::Duration(value) => v1_6::CellValue::Duration(value),
                            v1_5::CellValue::Instant(value) => v1_6::CellValue::Instant(value),
                            v1_5::CellValue::Image(value) => v1_6::CellValue::Image(value),
                        },
                    )
                })
                .collect(),
            vertical_align: column
                .vertical_align
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
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
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
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
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
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
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
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
                                symbol: v.value.symbol,
                            },
                            len: v.len,
                        },
                    )
                })
                .collect(),
            numeric_decimals: column
                .numeric_decimals
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            numeric_commas: column
                .numeric_commas
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            bold: column
                .bold
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            italic: column
                .italic
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            text_color: column
                .text_color
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            fill_color: column
                .fill_color
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        v1_6::ColumnRepeat {
                            value: v.value,
                            len: v.len,
                        },
                    )
                })
                .collect(),
            render_size: column
                .render_size
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        v1_6::ColumnRepeat {
                            value: v1_6::RenderSize {
                                w: v.value.w,
                                h: v.value.h,
                            },
                            len: v.len,
                        },
                    )
                })
                .collect(),
            date_time: Default::default(),
            underline: HashMap::new(),
            strike_through: HashMap::new(),
        },
    )
}

fn upgrade_columns(columns: Vec<(i64, v1_5::Column)>) -> Vec<(i64, v1_6::Column)> {
    columns
        .into_iter()
        .map(|(x, column)| upgrade_column(x, column))
        .collect()
}

fn upgrade_code_runs(
    code_runs: Vec<(v1_5::Pos, v1_5::CodeRun)>,
) -> Vec<(v1_6::Pos, v1_6::CodeRun)> {
    code_runs
        .into_iter()
        .map(|(pos, old_code_run)| {
            (
                v1_6::Pos { x: pos.x, y: pos.y },
                v1_6::CodeRun {
                    formatted_code_string: old_code_run.formatted_code_string,
                    last_modified: old_code_run.last_modified,
                    std_err: old_code_run.std_err,
                    std_out: old_code_run.std_out,
                    spill_error: old_code_run.spill_error,
                    cells_accessed: old_code_run.cells_accessed,
                    return_type: old_code_run.return_type,
                    line_number: old_code_run.line_number,
                    output_type: old_code_run.output_type,
                    result: match old_code_run.result {
                        v1_5::CodeRunResult::Ok(output_value) => {
                            v1_6::CodeRunResult::Ok(match output_value {
                                v1_5::OutputValue::Single(value) => {
                                    if value.type_field.to_lowercase() == "text" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Text(
                                            value.value,
                                        ))
                                    } else if value.type_field.to_lowercase() == "number" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Number(
                                            value.value,
                                        ))
                                    } else if value.type_field.to_lowercase() == "logical" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Logical(
                                            v1_5::string_bool(value.value),
                                        ))
                                    } else if value.type_field.to_lowercase() == "html" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Html(
                                            value.value,
                                        ))
                                    } else if value.type_field.to_lowercase() == "image" {
                                        v1_6::OutputValue::Single(v1_6::CellValue::Image(
                                            value.value,
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
                                            .into_iter()
                                            .map(|value| {
                                                if value.type_field.to_lowercase().as_str()
                                                    == "text"
                                                {
                                                    v1_6::CellValue::Text(value.value)
                                                } else if value.type_field.to_lowercase().as_str()
                                                    == "number"
                                                {
                                                    v1_6::CellValue::Number(value.value)
                                                } else if value.type_field.to_lowercase()
                                                    == "logical"
                                                {
                                                    v1_6::CellValue::Logical(v1_5::string_bool(
                                                        value.value,
                                                    ))
                                                } else if value.type_field.to_lowercase() == "html"
                                                {
                                                    v1_6::CellValue::Html(value.value)
                                                } else if value.type_field.to_lowercase() == "image"
                                                {
                                                    v1_6::CellValue::Image(value.value)
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
                                span: error.span,
                                msg: error.msg,
                            })
                        }
                    },
                },
            )
        })
        .collect()
}

fn upgrade_sheet(sheet: v1_5::Sheet) -> v1_6::Sheet {
    v1_6::Sheet {
        id: v1_6::Id::from(sheet.id.id),
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        columns: upgrade_columns(sheet.columns),
        borders: sheet.borders,
        code_runs: upgrade_code_runs(sheet.code_runs),
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
        sheets: schema.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(schema)
}

#[cfg(test)]
mod tests {
    use anyhow::{anyhow, Result};
    use serial_test::parallel;

    use crate::grid::file::v1_5::schema::GridSchema;

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
