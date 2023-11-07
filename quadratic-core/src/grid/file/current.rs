use crate::color::Rgba;
use crate::grid::{
    generate_borders, set_region_borders, BorderSelection, BorderStyle, CellAlign, CellBorderLine,
    CellWrap, Grid, GridBounds, NumericFormat, NumericFormatKind, RegionRef,
};
use crate::{CellValue, Error, ErrorMsg, Span, Value};

use crate::grid::file::v1_4::schema::{self as current};
use crate::grid::{
    block::SameValue, sheet::sheet_offsets::SheetOffsets, CellRef, CodeCellLanguage,
    CodeCellRunOutput, CodeCellRunResult, CodeCellValue, Column, ColumnData, ColumnId, RowId,
    Sheet, SheetBorders, SheetId,
};
use anyhow::{anyhow, Result};
use bigdecimal::BigDecimal;
use serde::de::DeserializeOwned;
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

fn set_column_format_numeric_format(
    column_data: &mut ColumnData<SameValue<NumericFormat>>,
    column: &HashMap<String, current::ColumnFormatType<current::NumericFormat>>,
) -> Result<()> {
    for (y, format) in column.iter() {
        let y =
            i64::from_str(y).map_err(|e| anyhow!("Unable to convert {} to an i64: {}", y, e))?;
        column_data.set(
            y,
            Some(NumericFormat {
                kind: NumericFormatKind::from_str(&format.content.value.kind.to_string())
                    .unwrap_or(NumericFormatKind::Number),
                symbol: format.content.value.symbol.to_owned(),
            }),
        );
    }

    Ok(())
}

fn set_column_format_i16(
    column_data: &mut ColumnData<SameValue<i16>>,
    column: &HashMap<String, current::ColumnFormatType<i16>>,
) -> Result<()> {
    for (y, format) in column.iter() {
        let y =
            i64::from_str(y).map_err(|e| anyhow!("Unable to convert {} to an i64: {}", y, e))?;
        column_data.set(y, Some(format.content.value));
    }

    Ok(())
}

fn set_column_format_string(
    column_data: &mut ColumnData<SameValue<String>>,
    column: &HashMap<String, current::ColumnFormatType<String>>,
) -> Result<()> {
    for (y, format) in column.iter() {
        let y =
            i64::from_str(y).map_err(|e| anyhow!("Unable to convert {} to an i64: {}", y, e))?;
        column_data.set(y, Some(format.content.value.to_string()));
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

fn import_column_builder(columns: &[(i64, current::Column)]) -> Result<BTreeMap<i64, Column>> {
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
            set_column_format_i16(&mut col.numeric_decimals, &column.numeric_decimals)?;
            set_column_format_numeric_format(&mut col.numeric_format, &column.numeric_format)?;
            set_column_format_bool(&mut col.bold, &column.bold)?;
            set_column_format_bool(&mut col.italic, &column.italic)?;
            set_column_format_string(&mut col.text_color, &column.text_color)?;
            set_column_format_string(&mut col.fill_color, &column.fill_color)?;

            for (y, value) in column.values.iter() {
                for cell_value in value.content.values.iter() {
                    let y = i64::from_str(y)
                        .map_err(|e| anyhow!("Could not convert {} to an i64: {}", &y, e))?;
                    match cell_value.type_field.to_lowercase().as_str() {
                        "text" => {
                            col.values
                                .set(y, Some(CellValue::Text(cell_value.value.to_owned())));
                        }
                        "number" => {
                            col.values.set(
                                y,
                                Some(CellValue::Number(BigDecimal::from_str(&cell_value.value)?)),
                            );
                        }
                        _ => {}
                    };
                }
            }

            Ok((*y, col))
        })
        .collect::<Result<BTreeMap<i64, Column>>>()
}

fn import_borders_builder(sheet: &mut Sheet, current_sheet: &mut current::Sheet) {
    current_sheet
        .borders
        .iter()
        .for_each(|(column_id, cell_borders)| {
            cell_borders.iter().for_each(|(y, cell_borders)| {
                cell_borders.iter().enumerate().for_each(|(index, border)| {
                    if let Some(border) = border {
                        let border_selection = match index {
                            0 => BorderSelection::Left,
                            1 => BorderSelection::Top,
                            2 => BorderSelection::Right,
                            3 => BorderSelection::Bottom,
                            _ => BorderSelection::Clear,
                        };
                        let style = BorderStyle {
                            color: Rgba::from_str(&border.color)
                                .unwrap_or_else(|_| Rgba::new(0, 0, 0, 255)),
                            line: CellBorderLine::from_str(&border.line)
                                .unwrap_or(CellBorderLine::Line1),
                        };

                        if let Ok(column_id) = ColumnId::from_str(column_id) {
                            let row_id = sheet.get_or_create_row(*y);
                            let region = RegionRef {
                                sheet: sheet.id,
                                columns: vec![column_id],
                                rows: vec![row_id.id],
                            };
                            let borders = generate_borders(
                                sheet,
                                &region,
                                vec![border_selection],
                                Some(style),
                            );

                            // necessary to fill in render_lookup in SheetBorders
                            set_region_borders(sheet, vec![region], borders);
                        }
                    }
                });
            });
        });
}

fn import_code_cell_builder(sheet: &current::Sheet) -> Result<HashMap<CellRef, CodeCellValue>> {
    sheet
        .code_cells
        .iter()
        .map(|(cell_ref, code_cell_value)| {
            Ok((
                CellRef {
                    sheet: SheetId::from_str(&cell_ref.sheet.id)?,
                    column: ColumnId::from_str(&cell_ref.column.id)?,
                    row: RowId::from_str(&cell_ref.row.id)?,
                },
                CodeCellValue {
                    language: CodeCellLanguage::from_str(&code_cell_value.language)?,
                    code_string: code_cell_value.code_string.to_owned(),
                    formatted_code_string: code_cell_value.formatted_code_string.to_owned(),
                    last_modified: code_cell_value.last_modified.to_owned(),
                    output: code_cell_value.output.to_owned().and_then(|output| {
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
                                                type_field: _type_field,
                                                value,
                                            },
                                        ) => Value::Single(CellValue::from(value)),
                                        current::OutputValue::Array(current::OutputArray {
                                            size,
                                            values,
                                        }) => Value::Array(crate::Array::from(
                                            values
                                                .chunks(size.w as usize)
                                                .map(|row| {
                                                    row.iter()
                                                        .map(|cell| {
                                                            match cell
                                                                .type_field
                                                                .to_lowercase()
                                                                .as_str()
                                                            {
                                                                "text" => CellValue::Text(
                                                                    cell.value.to_owned(),
                                                                ),
                                                                "number" => CellValue::Number(
                                                                    BigDecimal::from_str(
                                                                        &cell.value,
                                                                    )
                                                                    .unwrap_or_default(),
                                                                ),
                                                                _ => CellValue::Blank,
                                                            }
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
                                                sheet: SheetId::from_str(&cell.sheet.id)?,
                                                column: ColumnId::from_str(&cell.column.id)?,
                                                row: RowId::from_str(&cell.row.id)?,
                                            })
                                        })
                                        .collect::<Result<_>>()
                                        .ok()?,
                                },
                                current::CodeCellRunResult::Err { error } => {
                                    CodeCellRunResult::Err {
                                        error: Error {
                                            span: error.span.map(|span| Span {
                                                start: span.start,
                                                end: span.end,
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
        .collect::<Result<_>>()
}

pub fn import(file: current::GridSchema) -> Result<Grid> {
    Ok(Grid {
        sheets: file
            .sheets
            .into_iter()
            .map(|mut sheet| {
                let mut new_sheet = Sheet {
                    id: SheetId::from_str(&sheet.id.id)?,
                    name: sheet.name.to_owned(),
                    color: sheet.color.to_owned(),
                    order: sheet.order.to_owned(),
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
                    offsets: SheetOffsets::import(&sheet.offsets),
                    columns: import_column_builder(&sheet.columns)?,
                    // borders set after sheet is loaded
                    borders: SheetBorders::new(),
                    code_cells: import_code_cell_builder(&sheet)?,
                    data_bounds: GridBounds::Empty,
                    format_bounds: GridBounds::Empty,
                };
                new_sheet.recalculate_bounds();
                import_borders_builder(&mut new_sheet, &mut sheet);
                Ok(new_sheet)
            })
            .collect::<Result<_>>()?,
    })
}

fn export_column_data_bool(
    column_data: &ColumnData<SameValue<bool>>,
) -> HashMap<String, current::ColumnFormatType<bool>> {
    column_data
        .values()
        .map(|(y, value)| (y.to_string(), (y, value).into()))
        .collect()
}

fn export_column_data_string(
    column_data: &ColumnData<SameValue<String>>,
) -> HashMap<String, current::ColumnFormatType<String>> {
    column_data
        .values()
        .map(|(y, value)| (y.to_string(), (y, value).into()))
        .collect()
}

fn export_column_data_i16(
    column_data: &ColumnData<SameValue<i16>>,
) -> HashMap<String, current::ColumnFormatType<i16>> {
    column_data
        .values()
        .map(|(y, value)| (y.to_string(), (y, value).into()))
        .collect()
}

fn export_column_data_numeric_format(
    column_data: &ColumnData<SameValue<NumericFormat>>,
) -> HashMap<String, current::ColumnFormatType<current::NumericFormat>> {
    column_data
        .values()
        .map(|(y, value)| {
            (
                y.to_string(),
                current::ColumnFormatType {
                    y,
                    content: current::ColumnFormatContent {
                        value: current::NumericFormat {
                            kind: value.kind.to_string(),
                            symbol: value.symbol,
                        },
                        len: 1,
                    },
                },
            )
        })
        .collect()
}

fn export_column_data<T>(
    column_data: &ColumnData<SameValue<T>>,
) -> HashMap<String, current::ColumnFormatType<String>>
where
    T: Serialize + DeserializeOwned + Debug + Clone + PartialEq,
{
    column_data
        .values()
        .map(|(y, value)| {
            (
                y.to_string(),
                (y, serde_json::to_string(&value).unwrap_or_default()).into(),
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
                    spills: export_column_data(&column.spills),
                    align: export_column_data(&column.align),
                    wrap: export_column_data(&column.wrap),
                    numeric_decimals: export_column_data_i16(&column.numeric_decimals),
                    numeric_format: export_column_data_numeric_format(&column.numeric_format),
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
                                    current::ColumnValue {
                                        type_field: value.type_name().into(),
                                        value: value.to_string(),
                                    },
                                )
                                    .into(),
                            )
                        })
                        .collect(),
                },
            )
        })
        .collect()
}

fn export_borders_builder(sheet: &Sheet) -> current::Borders {
    sheet
        .borders()
        .per_cell
        .borders
        .iter()
        .map(|(column_id, border)| {
            (
                column_id.to_string(),
                border
                    .values()
                    .map(|(y, cell_borders)| {
                        (
                            y,
                            cell_borders
                                .borders
                                .iter()
                                .map(|border_style| {
                                    border_style.and_then(|border_style| {
                                        Some(current::CellBorder {
                                            color: border_style.color.as_string(),
                                            line: border_style.line.to_string(),
                                        })
                                    })
                                })
                                .collect(),
                        )
                    })
                    .collect(),
            )
        })
        .collect()
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
                columns: export_column_builder(sheet),
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
                borders: export_borders_builder(sheet),
                code_cells: sheet
                    .iter_code_cells_locations()
                    .map(|cell_ref| {
                        let code_cell_value = sheet.get_code_cell_from_ref(cell_ref).unwrap().clone();
                        (
                            cell_ref.into(),
                            current::CodeCellValue {
                                language: code_cell_value.language.to_string(),
                                code_string: code_cell_value.code_string,
                                formatted_code_string: code_cell_value.formatted_code_string,
                                last_modified: code_cell_value.last_modified,
                                output: code_cell_value.output.map(|output| current::CodeCellRunOutput {
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
                                                        span: error.span.map(|span| current::Span {
                                                                start: span.start,
                                                                end: span.end,
                                                            }),
                                                        msg: error.msg.to_string()
                                                    }
                                                }
                                            }
                                        },
                                    }),
                            },
                        )
                    })
                    .collect(),
            })
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const V1_4_FILE: &str = include_str!("../../../examples/v1_4_simple.grid");

    #[test]
    fn imports_and_exports_a_current_grid() {
        let file = serde_json::from_str::<current::GridSchema>(V1_4_FILE).unwrap();
        let mut imported = import(file).unwrap();
        let exported = export(&mut imported).unwrap();
        println!("{:?}", exported);
    }
}
