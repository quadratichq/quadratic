use crate::color::Rgba;
use crate::grid::formatting::RenderSize;
use crate::grid::{
    generate_borders, set_rect_borders, BorderSelection, BorderStyle, CellAlign, CellBorderLine,
    CellWrap, Grid, GridBounds, NumericFormat, NumericFormatKind,
};
use crate::{CellValue, Error, ErrorMsg, Pos, Rect, SheetPos, Span, Value};

use crate::grid::file::v1_5::schema::{self as current};
use crate::grid::{
    block::SameValue, sheet::sheet_offsets::SheetOffsets, CodeCellLanguage, CodeCellRunOutput,
    CodeCellRunResult, CodeCellValue, Column, ColumnData, Sheet, SheetBorders, SheetId,
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

fn set_column_format_render_size(
    column_data: &mut ColumnData<SameValue<RenderSize>>,
    column: &HashMap<String, current::ColumnFormatType<current::RenderSize>>,
) -> Result<()> {
    for (y, format) in column.iter() {
        let y =
            i64::from_str(y).map_err(|e| anyhow!("Unable to convert {} to an i64: {}", y, e))?;
        column_data.set(
            y,
            Some(RenderSize {
                w: format.content.value.w.clone(),
                h: format.content.value.h.clone(),
            }),
        );
    }
    Ok(())
}

fn import_column_builder(columns: &[(i64, current::Column)]) -> Result<BTreeMap<i64, Column>> {
    columns
        .iter()
        .map(|(x, column)| {
            let mut col = Column::new(*x);
            set_column_format::<Pos>(&mut col.spills, &column.spills)?;
            set_column_format::<CellAlign>(&mut col.align, &column.align)?;
            set_column_format::<CellWrap>(&mut col.wrap, &column.wrap)?;
            set_column_format_i16(&mut col.numeric_decimals, &column.numeric_decimals)?;
            set_column_format_numeric_format(&mut col.numeric_format, &column.numeric_format)?;
            set_column_format_bool(&mut col.numeric_commas, &column.numeric_commas)?;
            set_column_format_bool(&mut col.bold, &column.bold)?;
            set_column_format_bool(&mut col.italic, &column.italic)?;
            set_column_format_string(&mut col.text_color, &column.text_color)?;
            set_column_format_string(&mut col.fill_color, &column.fill_color)?;
            set_column_format_render_size(&mut col.render_size, &column.render_size)?;

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

            Ok((*x, col))
        })
        .collect::<Result<BTreeMap<i64, Column>>>()
}

fn import_borders_builder(sheet: &mut Sheet, current_sheet: &mut current::Sheet) {
    current_sheet.borders.iter().for_each(|(x, cell_borders)| {
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

                    // todo: this should save as an i64, not string
                    let rect = Rect::single_pos(Pos {
                        x: x.parse::<i64>().unwrap(),
                        y: *y,
                    });
                    let borders =
                        generate_borders(sheet, &rect, vec![border_selection], Some(style));

                    // necessary to fill in render_lookup in SheetBorders
                    set_rect_borders(sheet, &rect, borders);
                }
            });
        });
    });
}

fn import_code_cell_output(type_field: &str, value: &str) -> CellValue {
    match type_field.to_lowercase().as_str() {
        "text" => CellValue::Text(value.to_owned()),
        "number" => CellValue::Number(BigDecimal::from_str(value).unwrap_or_default()),
        "html" => CellValue::Html(value.to_owned()),
        _ => CellValue::Blank,
    }
}

fn import_code_cell_builder(sheet: &current::Sheet) -> Result<HashMap<Pos, CodeCellValue>> {
    sheet
        .code_cells
        .iter()
        .map(|(pos, code_cell_value)| {
            Ok((
                Pos { x: pos.x, y: pos.y },
                CodeCellValue {
                    language: CodeCellLanguage::from_str(&code_cell_value.language)?,
                    code_string: code_cell_value.code_string.to_owned(),
                    formatted_code_string: code_cell_value.formatted_code_string.to_owned(),
                    last_modified: code_cell_value.last_modified.to_owned(),
                    output: code_cell_value.output.to_owned().and_then(|output| {
                        Some(CodeCellRunOutput {
                            std_out: output.std_out,
                            std_err: output.std_err,
                            spill: output.spill,
                            result: match output.result {
                                current::CodeCellRunResult::Ok {
                                    output_value,
                                    cells_accessed,
                                } => CodeCellRunResult::Ok {
                                    output_value: match output_value {
                                        current::OutputValue::Single(
                                            current::OutputValueValue { type_field, value },
                                        ) => Value::Single(import_code_cell_output(
                                            &type_field,
                                            &value,
                                        )),
                                        current::OutputValue::Array(current::OutputArray {
                                            size,
                                            values,
                                        }) => Value::Array(crate::Array::from(
                                            values
                                                .chunks(size.w as usize)
                                                .map(|row| {
                                                    row.iter()
                                                        .map(|cell| {
                                                            import_code_cell_output(
                                                                &cell.type_field,
                                                                &cell.value,
                                                            )
                                                        })
                                                        .collect::<Vec<_>>()
                                                })
                                                .collect::<Vec<Vec<_>>>(),
                                        )),
                                    },
                                    cells_accessed: cells_accessed
                                        .into_iter()
                                        .map(|cell| {
                                            Ok(SheetPos {
                                                sheet_id: SheetId::from_str(&cell.sheet_id.id)?,
                                                x: cell.x,
                                                y: cell.y,
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

fn export_column_data_render_size(
    column_data: &ColumnData<SameValue<RenderSize>>,
) -> HashMap<String, current::ColumnFormatType<current::RenderSize>> {
    column_data
        .values()
        .map(|(y, value)| {
            (
                y.to_string(),
                current::ColumnFormatType {
                    y,
                    content: current::ColumnFormatContent {
                        value: current::RenderSize {
                            w: value.w,
                            h: value.h,
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
        .columns
        .iter()
        .map(|(x, column)| {
            (
                *x,
                current::Column {
                    x: *x,
                    spills: export_column_data(&column.spills),
                    align: export_column_data(&column.align),
                    wrap: export_column_data(&column.wrap),
                    numeric_decimals: export_column_data_i16(&column.numeric_decimals),
                    numeric_format: export_column_data_numeric_format(&column.numeric_format),
                    numeric_commas: export_column_data_bool(&column.numeric_commas),
                    bold: export_column_data_bool(&column.bold),
                    italic: export_column_data_bool(&column.italic),
                    text_color: export_column_data_string(&column.text_color),
                    fill_color: export_column_data_string(&column.fill_color),
                    render_size: export_column_data_render_size(&column.render_size),
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
        .map(|(x, border)| {
            (
                // todo: this should be i64
                x.to_string(),
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
                borders: export_borders_builder(sheet),
                code_cells: sheet
                    .iter_code_cells_locations()
                    .map(|pos| {
                        let code_cell_value = sheet.get_code_cell(pos).unwrap().clone();
                        (
                            pos.into(),
                            current::CodeCellValue {
                                language: code_cell_value.language.to_string(),
                                code_string: code_cell_value.code_string,
                                formatted_code_string: code_cell_value.formatted_code_string,
                                last_modified: code_cell_value.last_modified,
                                output: code_cell_value.output.map(|output| current::CodeCellRunOutput {
                                        std_out: output.std_out,
                                        std_err: output.std_err,
                                        spill: output.spill,
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

    const V1_4_FILE: &str = include_str!("../../../../rust-shared/data/grid/v1_4_simple.grid");

    #[test]
    fn imports_and_exports_a_current_grid() {
        let file = serde_json::from_str::<current::GridSchema>(V1_4_FILE).unwrap();
        let mut imported = import(file).unwrap();
        let exported = export(&mut imported).unwrap();
        println!("{:?}", exported);
    }
}
