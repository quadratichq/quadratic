use crate::grid::{CellAlign, CellWrap, Grid, GridBounds, NumericFormat};
use crate::{CellValue, Error, ErrorMsg, Span, Value};

use crate::grid::file::v1_5::schema::{self as current, ColumnValue};
use crate::grid::{
    block::SameValue, sheet::sheet_offsets::SheetOffsets, CellRef, CodeCellLanguage,
    CodeCellRunOutput, CodeCellRunResult, CodeCellValue, Column, ColumnData, ColumnId, RowId,
    Sheet, SheetBorders, SheetId,
};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap},
    fmt::Debug,
    str::FromStr,
};

use super::CURRENT_VERSION;

impl From<CellRef> for current::CellRef {
    fn from(cell_ref: CellRef) -> Self {
        Self {
            sheet: current::Id {
                id: cell_ref.sheet.to_string(),
            },
            column: current::Id {
                id: cell_ref.column.to_string(),
            },
            row: current::Id {
                id: cell_ref.row.to_string(),
            },
        }
    }
}

fn set_column_format<T>(
    column_data: &mut ColumnData<SameValue<T>>,
    column: &HashMap<String, current::ColumnFormatType<String>>,
) -> Result<()>
where
    T: Serialize + for<'d> Deserialize<'d> + Debug + Clone + PartialEq,
{
    for (y, format) in column.iter() {
        let y =
            i64::from_str(y).map_err(|e| anyhow!("Unable to convert {} to an i64: {}", y, e))?;
        column_data.set(y, serde_json::from_str(&format.content.value).ok());
    }

    Ok(())
}
fn set_column_format_bool(
    column_data: &mut ColumnData<SameValue<bool>>,
    column: &HashMap<String, current::ColumnFormatType<bool>>,
) -> Result<()> {
    for (y, format) in column.iter() {
        let y =
            i64::from_str(y).map_err(|e| anyhow!("Unable to convert {} to an i64: {}", y, e))?;
        column_data.set(y, Some(format.content.value));
    }

    Ok(())
}

fn import_column_builder(columns: Vec<(i64, current::Column)>) -> Result<BTreeMap<i64, Column>> {
    columns
        .iter()
        .map(|(y, column)| {
            let mut col = Column {
                id: ColumnId::from_str(&column.id.id)?,
                ..Default::default()
            };
            set_column_format::<CellRef>(&mut col.spills, &column.spills)?;
            set_column_format::<CellAlign>(&mut col.align, &column.align)?;
            set_column_format::<CellWrap>(&mut col.wrap, &column.wrap)?;
            set_column_format::<i16>(&mut col.numeric_decimals, &column.numeric_decimals)?;
            set_column_format::<NumericFormat>(&mut col.numeric_format, &column.numeric_format)?;
            set_column_format_bool(&mut col.bold, &column.bold)?;
            set_column_format_bool(&mut col.italic, &column.italic)?;
            set_column_format::<String>(&mut col.text_color, &column.text_color)?;
            set_column_format::<String>(&mut col.fill_color, &column.fill_color)?;

            for (y, value) in column.values.iter() {
                for cell_value in value.content.values.iter() {
                    match cell_value.type_field.to_lowercase().as_str() {
                        "text" => {
                            col.values.set(
                                i64::from_str(y).map_err(|e| {
                                    anyhow!("Could not convert {} to an i64: {}", &y, e)
                                })?,
                                Some(CellValue::Text(cell_value.value.to_owned())),
                            );
                        }
                        _ => {}
                    };
                }
            }

            Ok((*y, col))
        })
        // .flatten_ok()
        .collect::<Result<BTreeMap<i64, Column>>>()
}

fn export_column_data_bool(
    column_data: &ColumnData<SameValue<bool>>,
) -> HashMap<String, current::ColumnFormatType<bool>>
// where
//     T: Serialize + for<'d> Deserialize<'d> + Debug + Clone + PartialEq + Display,
{
    column_data
        .values()
        .map(|(y, value)| (y.to_string(), (y, value).into()))
        .collect()
}

fn export_column_data_string<T>(
    column_data: &ColumnData<SameValue<T>>,
) -> HashMap<String, current::ColumnFormatType<String>>
where
    T: Serialize + for<'d> Deserialize<'d> + Debug + Clone + PartialEq,
{
    column_data
        .values()
        .map(|(y, value)| {
            (
                y.to_string(),
                (y, serde_json::to_string(&value).unwrap()).into(),
            )
        })
        .collect()
}

fn export_column_builder(sheet: &Sheet) -> Vec<(i64, current::Column)> {
    sheet
        .iter_columns()
        .map(|(x, column)| {
            (
                x,
                current::Column {
                    id: current::Id {
                        id: column.id.to_string(),
                    },
                    spills: export_column_data_string(&column.spills),
                    align: export_column_data_string(&column.align),
                    wrap: export_column_data_string(&column.wrap),
                    numeric_decimals: export_column_data_string(&column.numeric_decimals),
                    numeric_format: export_column_data_string(&column.numeric_format),
                    bold: export_column_data_bool(&column.bold),
                    italic: export_column_data_bool(&column.italic),
                    text_color: export_column_data_string(&column.text_color),
                    fill_color: export_column_data_string(&column.fill_color),
                    values: column
                        .values
                        .values()
                        .map(|(y, value)| {
                            (
                                y.to_string(),
                                (
                                    y,
                                    ColumnValue {
                                        type_field: value.type_name().into(),
                                        value: value.to_string(),
                                    },
                                )
                                    .into(),
                            )
                        })
                        .collect(),
                    ..Default::default()
                },
            )
        })
        .collect()
}

pub fn import(file: current::GridSchema) -> Result<Grid> {
    Ok(Grid {
        sheets: file
            .sheets
            .into_iter()
            .map(|sheet| {
                let mut sheet = Sheet {
                    id: SheetId::from_str(&sheet.id.id)?,
                    name: sheet.name,
                    color: sheet.color,
                    order: sheet.order,
                    column_ids: sheet
                        .columns
                        .iter()
                        .map(|(x, column)| Ok((*x, ColumnId::from_str(&column.id.id)?)))
                        .collect::<Result<_>>()?,
                    row_ids: sheet
                        .rows
                        .iter()
                        .map(|(x, row)| Ok((*x, RowId::from_str(&row.id)?)))
                        .collect::<Result<_>>()?,
                    offsets: SheetOffsets::import(sheet.offsets),
                    columns: import_column_builder(sheet.columns)?,
                    // TODO(ddimaria): implement
                    // borders: sheet.borders,
                    borders: SheetBorders::new(),
                    code_cells: sheet
                        .code_cells
                        .into_iter()
                        .map(|(cell_ref, code_cell_value)| {
                            Ok((
                                CellRef {
                                    sheet: SheetId::from_str(&cell_ref.sheet.id)?,
                                    column: ColumnId::from_str(&cell_ref.column.id)?,
                                    row: RowId::from_str(&cell_ref.row.id)?,
                                },
                                CodeCellValue {
                                    language: CodeCellLanguage::from_str(
                                        &code_cell_value.language,
                                    )?,
                                    code_string: code_cell_value.code_string,
                                    formatted_code_string: code_cell_value.formatted_code_string,
                                    last_modified: code_cell_value.last_modified,
                                    output: code_cell_value.output.and_then(|output| {
                                        Some(CodeCellRunOutput {
                                            std_out: output.std_out,
                                            std_err: output.std_err,
                                            result: match output.result {
                                                current::CodeCellRunResult::Ok {
                                                    output_value,
                                                    cells_accessed,
                                                } => CodeCellRunResult::Ok {
                                                    output_value: match output_value {
                                                        current::OutputValue::Single(
                                                            current::OutputValueValue {
                                                                type_field,
                                                                value,
                                                            },
                                                        ) => Value::Single(CellValue::from(value)),
                                                        current::OutputValue::Array(
                                                            current::OutputArray { size, values },
                                                        ) => Value::Array(crate::Array::from(
                                                            values
                                                                .chunks(size.w as usize)
                                                                .map(|row| {
                                                                    row.iter()
                                                                        .map(|cell| {
                                                                            cell.value.to_string()
                                                                        })
                                                                        .collect::<Vec<_>>()
                                                                })
                                                                .collect::<Vec<Vec<_>>>(),
                                                        )),
                                                    },
                                                    cells_accessed: cells_accessed
                                                        .into_iter()
                                                        .map(|cell| {
                                                            Ok(CellRef {
                                                                sheet: SheetId::from_str(
                                                                    &cell.sheet.id,
                                                                )?,
                                                                column: ColumnId::from_str(
                                                                    &cell.column.id,
                                                                )?,
                                                                row: RowId::from_str(&cell.row.id)?,
                                                            })
                                                        })
                                                        .collect::<Result<_>>()
                                                        .ok()?,
                                                },
                                                current::CodeCellRunResult::Err { error } => {
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
                            ))
                        })
                        .collect::<Result<_>>()?,
                    data_bounds: GridBounds::Empty,
                    format_bounds: GridBounds::Empty,
                };
                sheet.recalculate_bounds();
                Ok(sheet)
            })
            .collect::<Result<_>>()?,
        // TODO(ddimaria): remove as dependencies are being removed in another branch
        dependencies: HashMap::new(),
    })
}

pub fn export(grid: &mut Grid) -> Result<current::GridSchema> {
    Ok(current::GridSchema {
        version: Some(CURRENT_VERSION.into()),
        sheets: grid
            .sheets_mut()
            .iter()
            .map(|sheet| current::Sheet {
                id: current::Id {
                    id: sheet.id.to_string(),
                },
                name: sheet.name.to_owned(),
                color: sheet.color.to_owned(),
                order: sheet.order.to_owned(),
                offsets: sheet.offsets.export(),
                columns: export_column_builder(&sheet),
                rows: sheet
                    .iter_rows()
                    .map(|(x, row_id)| {
                        (
                            x,
                            current::Id {
                                id: row_id.to_string(),
                            },
                        )
                    })
                    .collect(),
                // TODO(ddimaria): implement
                // borders: sheet.borders(), // TODO: serialize borders
                borders: current::Borders {
                    horizontal: HashMap::new(),
                    vertical: HashMap::new(),
                },
                // TODO(ddimaria): implement
                code_cells: sheet
                    .iter_code_cells_locations()
                    .map(|cell_ref| {
                        let code_cell_value = sheet.get_code_cell_from_ref(cell_ref).unwrap().clone();
                        (
                            cell_ref.into(),
                            current::CodeCellValue {
                                language: code_cell_value.language.to_string(),
                                code_string: code_cell_value.code_string,
                                formatted_code_string: code_cell_value.formatted_code_string.and_then(|formatted| Some(formatted)),
                                last_modified: code_cell_value.last_modified,
                                output: code_cell_value.output.and_then(|output| {
                                    Some(current::CodeCellRunOutput {
                                        std_out: output.std_out,
                                        std_err: output.std_err,
                                        result: match output.result {
                                            CodeCellRunResult::Ok {
                                                output_value,
                                                cells_accessed,
                                            } => current::CodeCellRunResult::Ok {
                                                output_value: match output_value {
                                                    Value::Single(cell_value) => {
                                                        current::OutputValue::Single(
                                                            current::OutputValueValue {
                                                                type_field: cell_value
                                                                    .type_name()
                                                                    .into(),
                                                                value: cell_value.to_string(),
                                                            },
                                                        )
                                                    }
                                                    Value::Array(array) => {
                                                        current::OutputValue::Array(
                                                            current::OutputArray {
                                                                size: current::OutputSize {
                                                                    w: array.width() as i64,
                                                                    h: array.height() as i64,
                                                                },
                                                                values: array
                                                                    .rows().flat_map(|row| {
                                                                        row.iter().map(|cell| {
                                                                            current::OutputValueValue {
                                                                                type_field: cell
                                                                                    .type_name()
                                                                                    .into(),
                                                                                value: cell
                                                                                    .to_string(),
                                                                            }
                                                                        })
                                                                    })
                                                                    .collect(),
                                                            },
                                                        )
                                                    }
                                                },
                                                cells_accessed: cells_accessed.into_iter().map(|cell_ref| cell_ref.into()).collect(),
                                            },
                                            CodeCellRunResult::Err { error } => {
                                                current::CodeCellRunResult::Err {
                                                    error: current::Error {
                                                        span: error.span.and_then(|span| {
                                                            Some(current::Span {
                                                                start: span.start,
                                                                end: span.end,
                                                            })
                                                        }),
                                                        msg: error.msg.to_string()
                                                    }
                                                }
                                            }
                                        },
                                    })
                                }),
                            },
                        )
                    })
                    .collect(),
            })
            .collect(),
        // TODO(ddimaria): remove as dependencies are being removed in another branch
        dependencies: vec![],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const V1_5_FILE: &str = include_str!("../../../examples/v1_5.json");

    #[test]
    fn imports_and_exports_a_current_grid() {
        let file = serde_json::from_str::<current::GridSchema>(V1_5_FILE).unwrap();
        let mut imported = import(file).unwrap();
        let exported = export(&mut imported).unwrap();
        println!("{:?}", exported);
    }
}
