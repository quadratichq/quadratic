use crate::color::Rgba;
use crate::grid::file::v1_5::schema::{self as current};
use crate::grid::{
    block::SameValue, formatting::RenderSize, generate_borders, set_rect_borders,
    sheet::sheet_offsets::SheetOffsets, BorderSelection, BorderStyle, CellAlign, CellBorderLine,
    CellWrap, CodeRun, Column, ColumnData, Grid, GridBounds, NumericFormat, NumericFormatKind,
    Sheet, SheetBorders, SheetId,
};
use crate::grid::{CodeCellLanguage, CodeRunResult};
use crate::{CellValue, CodeCellValue, Pos, Rect, Value};
use anyhow::Result;
use bigdecimal::BigDecimal;
use chrono::Utc;
use indexmap::IndexMap;
use std::{
    collections::{BTreeMap, HashMap},
    str::FromStr,
};

use super::CURRENT_VERSION;

fn set_column_format_align(
    column_data: &mut ColumnData<SameValue<CellAlign>>,
    column: &HashMap<String, current::ColumnRepeat<current::CellAlign>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(match format.value {
                    current::CellAlign::Left => CellAlign::Left,
                    current::CellAlign::Center => CellAlign::Center,
                    current::CellAlign::Right => CellAlign::Right,
                }),
            );
        }
    }
}

fn set_column_format_wrap(
    column_data: &mut ColumnData<SameValue<CellWrap>>,
    column: &HashMap<String, current::ColumnRepeat<current::CellWrap>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(match format.value {
                    current::CellWrap::Wrap => CellWrap::Wrap,
                    current::CellWrap::Overflow => CellWrap::Overflow,
                    current::CellWrap::Clip => CellWrap::Clip,
                }),
            );
        }
    }
}

fn set_column_format_numeric_format(
    column_data: &mut ColumnData<SameValue<NumericFormat>>,
    column: &HashMap<String, current::ColumnRepeat<current::NumericFormat>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(NumericFormat {
                    kind: match format.value.kind {
                        current::NumericFormatKind::Number => NumericFormatKind::Number,
                        current::NumericFormatKind::Currency => NumericFormatKind::Currency,
                        current::NumericFormatKind::Percentage => NumericFormatKind::Percentage,
                        current::NumericFormatKind::Exponential => NumericFormatKind::Exponential,
                    },
                    symbol: format.value.symbol.to_owned(),
                }),
            );
        }
    }
}

fn set_column_format_i16(
    column_data: &mut ColumnData<SameValue<i16>>,
    column: &HashMap<String, current::ColumnRepeat<i16>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(y, Some(format.value));
        }
    }
}

fn set_column_format_string(
    column_data: &mut ColumnData<SameValue<String>>,
    column: &HashMap<String, current::ColumnRepeat<String>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(y, Some(format.value.clone()));
        }
    }
}

fn set_column_format_bool(
    column_data: &mut ColumnData<SameValue<bool>>,
    column: &HashMap<String, current::ColumnRepeat<bool>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(y, Some(format.value));
        }
    }
}

fn set_column_format_render_size(
    column_data: &mut ColumnData<SameValue<RenderSize>>,
    column: &HashMap<String, current::ColumnRepeat<current::RenderSize>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(RenderSize {
                    w: format.value.w.clone(),
                    h: format.value.h.clone(),
                }),
            );
        }
    }
}

fn import_column_builder(columns: &[(i64, current::Column)]) -> Result<BTreeMap<i64, Column>> {
    columns
        .iter()
        .map(|(x, column)| {
            let mut col = Column::new(*x);
            set_column_format_align(&mut col.align, &column.align);
            set_column_format_wrap(&mut col.wrap, &column.wrap);
            set_column_format_i16(&mut col.numeric_decimals, &column.numeric_decimals);
            set_column_format_numeric_format(&mut col.numeric_format, &column.numeric_format);
            set_column_format_bool(&mut col.numeric_commas, &column.numeric_commas);
            set_column_format_bool(&mut col.bold, &column.bold);
            set_column_format_bool(&mut col.italic, &column.italic);
            set_column_format_string(&mut col.text_color, &column.text_color);
            set_column_format_string(&mut col.fill_color, &column.fill_color);
            set_column_format_render_size(&mut col.render_size, &column.render_size);

            for (y, value) in column.values.iter() {
                let cell_value = match value {
                    current::CellValue::Blank => CellValue::Blank,
                    current::CellValue::Text(text) => CellValue::Text(text.to_owned()),
                    current::CellValue::Number(number) => {
                        CellValue::Number(BigDecimal::from_str(number)?)
                    }
                    current::CellValue::Html(html) => CellValue::Html(html.to_owned()),
                    current::CellValue::Code(code_cell) => CellValue::Code(CodeCellValue {
                        code: code_cell.code.to_owned(),
                        language: match code_cell.language {
                            current::CodeCellLanguage::Python => CodeCellLanguage::Python,
                            current::CodeCellLanguage::Formula => CodeCellLanguage::Formula,
                        },
                    }),
                    current::CellValue::Logical(logical) => CellValue::Logical(*logical),
                    current::CellValue::Instant(instant) => {
                        CellValue::Instant(serde_json::from_str(instant)?)
                    }
                    current::CellValue::Duration(duration) => {
                        CellValue::Duration(serde_json::from_str(duration)?)
                    }
                    current::CellValue::Error(error) => {
                        CellValue::Error(Box::new((*error).clone().into()))
                    }
                };
                col.values.set(y.parse::<i64>().unwrap(), Some(cell_value));
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
                    let x = x.parse::<i64>().unwrap();
                    let rect = Rect::single_pos(Pos { x, y: *y });
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

fn import_code_cell_builder(sheet: &current::Sheet) -> Result<IndexMap<Pos, CodeRun>> {
    // davidfig: probably the more idiomatic way is to return the code_runs below. It's above my skill level, though.
    let mut code_runs = IndexMap::new();

    sheet.code_runs.iter().for_each(|(pos, code_run)| {
        let cells_accessed = code_run
            .cells_accessed
            .iter()
            .map(|sheet_rect| crate::SheetRect::from(sheet_rect.clone()))
            .collect();

        let result = match &code_run.result {
            current::CodeRunResult::Ok(output) => CodeRunResult::Ok(match output {
                current::OutputValue::Single(current::OutputValueValue { type_field, value }) => {
                    Value::Single(import_code_cell_output(type_field, value))
                }
                current::OutputValue::Array(current::OutputArray { size, values }) => {
                    Value::Array(crate::Array::from(
                        values
                            .chunks(size.w as usize)
                            .map(|row| {
                                row.iter()
                                    .map(|cell| {
                                        import_code_cell_output(&cell.type_field, &cell.value)
                                    })
                                    .collect::<Vec<_>>()
                            })
                            .collect::<Vec<Vec<_>>>(),
                    ))
                }
            }),
            current::CodeRunResult::Err(error) => CodeRunResult::Err(error.clone().into()),
        };
        code_runs.insert(
            Pos { x: pos.x, y: pos.y },
            CodeRun {
                formatted_code_string: code_run.formatted_code_string.to_owned(),
                last_modified: code_run.last_modified.unwrap_or(Utc::now()), // this is required but fall back to now if failed
                std_out: code_run.std_out.to_owned(),
                std_err: code_run.std_err.to_owned(),
                spill_error: code_run.spill_error,
                cells_accessed,
                result,
            },
        );
    });
    Ok(code_runs)
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
                    code_runs: import_code_cell_builder(&sheet)?,
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
) -> HashMap<String, current::ColumnRepeat<bool>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: block.content.value,
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

fn export_column_data_string(
    column_data: &ColumnData<SameValue<String>>,
) -> HashMap<String, current::ColumnRepeat<String>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: block.content.value.clone(),
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

fn export_column_data_i16(
    column_data: &ColumnData<SameValue<i16>>,
) -> HashMap<String, current::ColumnRepeat<i16>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: block.content.value,
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

fn export_column_data_numeric_format(
    column_data: &ColumnData<SameValue<NumericFormat>>,
) -> HashMap<String, current::ColumnRepeat<current::NumericFormat>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: current::NumericFormat {
                        kind: match block.content.value.kind {
                            NumericFormatKind::Number => current::NumericFormatKind::Number,
                            NumericFormatKind::Currency => current::NumericFormatKind::Currency,
                            NumericFormatKind::Percentage => current::NumericFormatKind::Percentage,
                            NumericFormatKind::Exponential => {
                                current::NumericFormatKind::Exponential
                            }
                        },
                        symbol: block.content.value.symbol.clone(),
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

fn export_column_data_render_size(
    column_data: &ColumnData<SameValue<RenderSize>>,
) -> HashMap<String, current::ColumnRepeat<current::RenderSize>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: current::RenderSize {
                        w: block.content.value.w.clone(),
                        h: block.content.value.h.clone(),
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

fn export_column_data_align(
    column_data: &ColumnData<SameValue<CellAlign>>,
) -> HashMap<String, current::ColumnRepeat<current::CellAlign>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: match block.content.value {
                        CellAlign::Left => current::CellAlign::Left,
                        CellAlign::Center => current::CellAlign::Center,
                        CellAlign::Right => current::CellAlign::Right,
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

fn export_column_data_wrap(
    column_data: &ColumnData<SameValue<CellWrap>>,
) -> HashMap<String, current::ColumnRepeat<current::CellWrap>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: match block.content.value {
                        CellWrap::Wrap => current::CellWrap::Wrap,
                        CellWrap::Overflow => current::CellWrap::Overflow,
                        CellWrap::Clip => current::CellWrap::Clip,
                    },
                    len: block.len() as u32,
                },
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
                    align: export_column_data_align(&column.align),
                    wrap: export_column_data_wrap(&column.wrap),
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
                                match value {
                                    CellValue::Text(text) => {
                                        current::CellValue::Text(text.to_owned())
                                    }
                                    CellValue::Number(number) => {
                                        current::CellValue::Number(number.to_string())
                                    }
                                    CellValue::Html(html) => current::CellValue::Html(html),
                                    CellValue::Code(cell_code) => {
                                        current::CellValue::Code(current::CodeCell {
                                            code: cell_code.code.to_owned(),
                                            language: match cell_code.language {
                                                CodeCellLanguage::Python => {
                                                    current::CodeCellLanguage::Python
                                                }
                                                CodeCellLanguage::Formula => {
                                                    current::CodeCellLanguage::Formula
                                                }
                                            },
                                        })
                                    }
                                    CellValue::Logical(logical) => {
                                        current::CellValue::Logical(logical)
                                    }
                                    CellValue::Instant(instant) => {
                                        current::CellValue::Instant(instant.to_string())
                                    }
                                    CellValue::Duration(duration) => {
                                        current::CellValue::Duration(duration.to_string())
                                    }
                                    CellValue::Error(error) => current::CellValue::Error(
                                        current::RunError::from_grid_run_error(&error),
                                    ),
                                    CellValue::Blank => current::CellValue::Blank,
                                },
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
            .sheets()
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
                code_runs: sheet
                    .code_runs
                    .iter()
                    .map(|(pos, code_run)| {
                        let result = match &code_run.result {
                            CodeRunResult::Ok(output) => current::CodeRunResult::Ok(match output {
                                Value::Single(cell_value) => {
                                    current::OutputValue::Single(current::OutputValueValue {
                                        type_field: cell_value.type_name().into(),
                                        value: cell_value.to_string(),
                                    })
                                }
                                Value::Array(array) => {
                                    current::OutputValue::Array(current::OutputArray {
                                        size: current::OutputSize {
                                            w: array.width() as i64,
                                            h: array.height() as i64,
                                        },
                                        values: array
                                            .rows()
                                            .flat_map(|row| {
                                                row.iter().map(|cell| current::OutputValueValue {
                                                    type_field: cell.type_name().into(),
                                                    value: cell.to_string(),
                                                })
                                            })
                                            .collect(),
                                    })
                                }
                            }),
                            CodeRunResult::Err(error) => current::CodeRunResult::Err(
                                current::RunError::from_grid_run_error(error),
                            ),
                        };

                        (
                            current::Pos::from(*pos),
                            current::CodeRun {
                                formatted_code_string: code_run.formatted_code_string.clone(),
                                last_modified: Some(code_run.last_modified),
                                std_out: code_run.std_out.clone(),
                                std_err: code_run.std_err.clone(),
                                spill_error: code_run.spill_error,
                                cells_accessed: code_run
                                    .cells_accessed
                                    .iter()
                                    .map(|sheet_rect| current::SheetRect::from(*sheet_rect))
                                    .collect(),
                                result,
                            },
                        )
                    })
                    .collect(),
            })
            .collect(),
    })
}
