use std::collections::{BTreeMap, HashMap};
use std::str::FromStr;

use anyhow::Result;
use chrono::Utc;
use indexmap::IndexMap;

use super::v1_6::file::{export_cell_value, import_cell_value};
use super::CURRENT_VERSION;
use crate::color::Rgba;
use crate::grid::block::SameValue;
use crate::grid::file::v1_6::schema::{self as current};
use crate::grid::formats::format::Format;
use crate::grid::formatting::RenderSize;
use crate::grid::resize::{Resize, ResizeMap};
use crate::grid::{
    generate_borders, set_rect_borders, BorderSelection, BorderStyle, CellAlign, CellBorderLine,
    CellVerticalAlign, CellWrap, CodeRun, CodeRunResult, Column, ColumnData, Grid, GridBounds,
    NumericFormat, NumericFormatKind, Sheet, SheetBorders, SheetId,
};
use crate::sheet_offsets::SheetOffsets;
use crate::{CellValue, Pos, Rect, Value};

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

fn set_column_format_vertical_align(
    column_data: &mut ColumnData<SameValue<CellVerticalAlign>>,
    column: &HashMap<String, current::ColumnRepeat<current::CellVerticalAlign>>,
) {
    for (y, format) in column.iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(match format.value {
                    current::CellVerticalAlign::Top => CellVerticalAlign::Top,
                    current::CellVerticalAlign::Middle => CellVerticalAlign::Middle,
                    current::CellVerticalAlign::Bottom => CellVerticalAlign::Bottom,
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
            set_column_format_vertical_align(&mut col.vertical_align, &column.vertical_align);
            set_column_format_wrap(&mut col.wrap, &column.wrap);
            set_column_format_i16(&mut col.numeric_decimals, &column.numeric_decimals);
            set_column_format_numeric_format(&mut col.numeric_format, &column.numeric_format);
            set_column_format_bool(&mut col.numeric_commas, &column.numeric_commas);
            set_column_format_bool(&mut col.bold, &column.bold);
            set_column_format_bool(&mut col.italic, &column.italic);
            set_column_format_string(&mut col.text_color, &column.text_color);
            set_column_format_string(&mut col.fill_color, &column.fill_color);
            set_column_format_render_size(&mut col.render_size, &column.render_size);

            // todo: there's probably a better way of doing this
            for (y, value) in column.values.iter() {
                let cell_value = import_cell_value(value);
                if let Ok(y) = y.parse::<i64>() {
                    col.values.insert(y, cell_value);
                }
            }

            Ok((*x, col))
        })
        .collect::<Result<BTreeMap<i64, Column>>>()
}

fn import_borders_builder(sheet: &mut Sheet, current_sheet: &current::Sheet) {
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
                        color: Rgba::color_from_str(&border.color).unwrap_or(Rgba {
                            red: 0,
                            green: 0,
                            blue: 0,
                            alpha: 255,
                        }),
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

fn import_code_cell_builder(sheet: &current::Sheet) -> Result<IndexMap<Pos, CodeRun>> {
    let mut code_runs = IndexMap::new();

    sheet.code_runs.iter().for_each(|(pos, code_run)| {
        let cells_accessed = code_run
            .cells_accessed
            .iter()
            .map(|sheet_rect| crate::SheetRect::from(sheet_rect.clone()))
            .collect();

        let result = match &code_run.result {
            current::CodeRunResult::Ok(output) => CodeRunResult::Ok(match output {
                current::OutputValue::Single(value) => Value::Single(import_cell_value(value)),
                current::OutputValue::Array(current::OutputArray { size, values }) => {
                    Value::Array(crate::Array::from(
                        values
                            .chunks(size.w as usize)
                            .map(|row| row.iter().map(import_cell_value).collect::<Vec<_>>())
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
                return_type: code_run.return_type.to_owned(),
                line_number: code_run.line_number.to_owned(),
                output_type: code_run.output_type.to_owned(),
            },
        );
    });
    Ok(code_runs)
}

fn import_format(format: &current::Format) -> Format {
    Format {
        align: format.align.as_ref().map(|align| match align {
            current::CellAlign::Left => CellAlign::Left,
            current::CellAlign::Center => CellAlign::Center,
            current::CellAlign::Right => CellAlign::Right,
        }),
        vertical_align: format
            .vertical_align
            .as_ref()
            .map(|vertical_align| match vertical_align {
                current::CellVerticalAlign::Top => CellVerticalAlign::Top,
                current::CellVerticalAlign::Middle => CellVerticalAlign::Middle,
                current::CellVerticalAlign::Bottom => CellVerticalAlign::Bottom,
            }),
        wrap: format.wrap.as_ref().map(|wrap| match wrap {
            current::CellWrap::Wrap => CellWrap::Wrap,
            current::CellWrap::Overflow => CellWrap::Overflow,
            current::CellWrap::Clip => CellWrap::Clip,
        }),
        numeric_format: format
            .numeric_format
            .as_ref()
            .map(|numeric_format| NumericFormat {
                kind: match numeric_format.kind {
                    current::NumericFormatKind::Number => NumericFormatKind::Number,
                    current::NumericFormatKind::Currency => NumericFormatKind::Currency,
                    current::NumericFormatKind::Percentage => NumericFormatKind::Percentage,
                    current::NumericFormatKind::Exponential => NumericFormatKind::Exponential,
                },
                symbol: numeric_format.symbol.to_owned(),
            }),
        numeric_decimals: format.numeric_decimals,
        numeric_commas: format.numeric_commas,
        bold: format.bold,
        italic: format.italic,
        text_color: format.text_color.to_owned(),
        fill_color: format.fill_color.to_owned(),
        render_size: format.render_size.as_ref().map(|render_size| RenderSize {
            w: render_size.w.to_owned(),
            h: render_size.h.to_owned(),
        }),
    }
}

fn import_formats(format: &[(i64, (current::Format, i64))]) -> BTreeMap<i64, (Format, i64)> {
    format
        .iter()
        .map(|(i, (format, timestamp))| (*i, (import_format(format), *timestamp)))
        .collect()
}

pub fn import_rows_size(row_sizes: &[(i64, current::Resize)]) -> Result<ResizeMap> {
    row_sizes
        .iter()
        .try_fold(ResizeMap::default(), |mut sizes, (y, size)| {
            sizes.set_resize(
                *y,
                match size {
                    current::Resize::Auto => Resize::Auto,
                    current::Resize::Manual => Resize::Manual,
                },
            );
            Ok(sizes)
        })
}

pub fn import_sheet(sheet: current::Sheet) -> Result<Sheet> {
    let mut new_sheet = Sheet {
        id: SheetId::from_str(&sheet.id.id)?,
        name: sheet.name.to_owned(),
        color: sheet.color.to_owned(),
        order: sheet.order.to_owned(),
        offsets: SheetOffsets::import(&sheet.offsets),
        columns: import_column_builder(&sheet.columns)?,

        // borders set after sheet is loaded
        // todo: borders need to be refactored
        borders: SheetBorders::new(),

        code_runs: import_code_cell_builder(&sheet)?,
        data_bounds: GridBounds::Empty,
        format_bounds: GridBounds::Empty,

        format_all: sheet.formats_all.as_ref().map(import_format),
        formats_columns: import_formats(&sheet.formats_columns),
        formats_rows: import_formats(&sheet.formats_rows),

        rows_resize: import_rows_size(&sheet.rows_resize)?,
    };
    new_sheet.recalculate_bounds();
    import_borders_builder(&mut new_sheet, &sheet);
    Ok(new_sheet)
}

pub fn import(file: current::GridSchema) -> Result<Grid> {
    Ok(Grid {
        sheets: file
            .sheets
            .into_iter()
            .map(import_sheet)
            .collect::<Result<_>>()?,
    })
}

fn export_column_data_bool(
    column_data: ColumnData<SameValue<bool>>,
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
    column_data: ColumnData<SameValue<String>>,
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
    column_data: ColumnData<SameValue<i16>>,
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
    column_data: ColumnData<SameValue<NumericFormat>>,
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
    column_data: ColumnData<SameValue<RenderSize>>,
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
    column_data: ColumnData<SameValue<CellAlign>>,
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

fn export_column_data_vertical_align(
    column_data: ColumnData<SameValue<CellVerticalAlign>>,
) -> HashMap<String, current::ColumnRepeat<current::CellVerticalAlign>> {
    column_data
        .blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeat {
                    value: match block.content.value {
                        CellVerticalAlign::Top => current::CellVerticalAlign::Top,
                        CellVerticalAlign::Middle => current::CellVerticalAlign::Middle,
                        CellVerticalAlign::Bottom => current::CellVerticalAlign::Bottom,
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

fn export_column_data_wrap(
    column_data: ColumnData<SameValue<CellWrap>>,
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

fn export_values(values: BTreeMap<i64, CellValue>) -> HashMap<String, current::CellValue> {
    values
        .into_iter()
        .map(|(y, value)| (y.to_string(), export_cell_value(value)))
        .collect()
}

fn export_column_builder(sheet: Sheet) -> Vec<(i64, current::Column)> {
    sheet
        .columns
        .into_iter()
        .map(|(x, column)| {
            (
                x,
                current::Column {
                    align: export_column_data_align(column.align),
                    vertical_align: export_column_data_vertical_align(column.vertical_align),
                    wrap: export_column_data_wrap(column.wrap),
                    numeric_decimals: export_column_data_i16(column.numeric_decimals),
                    numeric_format: export_column_data_numeric_format(column.numeric_format),
                    numeric_commas: export_column_data_bool(column.numeric_commas),
                    bold: export_column_data_bool(column.bold),
                    italic: export_column_data_bool(column.italic),
                    text_color: export_column_data_string(column.text_color),
                    fill_color: export_column_data_string(column.fill_color),
                    render_size: export_column_data_render_size(column.render_size),
                    values: export_values(column.values),
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

fn export_format(format: &Format) -> Option<current::Format> {
    if format.is_default() {
        None
    } else {
        Some(current::Format {
            align: format.align.map(|align| match align {
                CellAlign::Left => current::CellAlign::Left,
                CellAlign::Center => current::CellAlign::Center,
                CellAlign::Right => current::CellAlign::Right,
            }),
            vertical_align: format
                .vertical_align
                .map(|vertical_align| match vertical_align {
                    CellVerticalAlign::Top => current::CellVerticalAlign::Top,
                    CellVerticalAlign::Middle => current::CellVerticalAlign::Middle,
                    CellVerticalAlign::Bottom => current::CellVerticalAlign::Bottom,
                }),
            wrap: format.wrap.map(|wrap| match wrap {
                CellWrap::Wrap => current::CellWrap::Wrap,
                CellWrap::Overflow => current::CellWrap::Overflow,
                CellWrap::Clip => current::CellWrap::Clip,
            }),
            numeric_format: format.numeric_format.as_ref().map(|numeric_format| {
                current::NumericFormat {
                    kind: match numeric_format.kind {
                        NumericFormatKind::Number => current::NumericFormatKind::Number,
                        NumericFormatKind::Currency => current::NumericFormatKind::Currency,
                        NumericFormatKind::Percentage => current::NumericFormatKind::Percentage,
                        NumericFormatKind::Exponential => current::NumericFormatKind::Exponential,
                    },
                    symbol: numeric_format.symbol.to_owned(),
                }
            }),
            numeric_decimals: format.numeric_decimals,
            numeric_commas: format.numeric_commas,
            bold: format.bold,
            italic: format.italic,
            text_color: format.text_color.to_owned(),
            fill_color: format.fill_color.to_owned(),
            render_size: format
                .render_size
                .as_ref()
                .map(|render_size| current::RenderSize {
                    w: render_size.w.to_owned(),
                    h: render_size.h.to_owned(),
                }),
        })
    }
}

fn export_formats(formats: &BTreeMap<i64, (Format, i64)>) -> Vec<(i64, (current::Format, i64))> {
    formats
        .iter()
        .filter_map(|(y, (format, timestamp))| {
            let f = export_format(format)?;
            Some((*y, (f, timestamp.to_owned())))
        })
        .collect()
}

pub fn export_rows_size(sheet: &Sheet) -> Vec<(i64, current::Resize)> {
    sheet
        .iter_row_resize()
        .map(|(y, resize)| {
            (
                y,
                match resize {
                    Resize::Auto => current::Resize::Auto,
                    Resize::Manual => current::Resize::Manual,
                },
            )
        })
        .collect()
}

pub fn export_rows_code_runs(sheet: &Sheet) -> Vec<(current::Pos, current::CodeRun)> {
    sheet
        .code_runs
        .iter()
        .map(|(pos, code_run)| {
            let result = match &code_run.result {
                CodeRunResult::Ok(output) => match output {
                    Value::Single(cell_value) => current::CodeRunResult::Ok(
                        current::OutputValue::Single(export_cell_value(cell_value.to_owned())),
                    ),
                    Value::Array(array) => current::CodeRunResult::Ok(current::OutputValue::Array(
                        current::OutputArray {
                            size: current::OutputSize {
                                w: array.width() as i64,
                                h: array.height() as i64,
                            },
                            values: array
                                .rows()
                                .flat_map(|row| {
                                    row.iter()
                                        .map(|cell_value| export_cell_value(cell_value.to_owned()))
                                })
                                .collect(),
                        },
                    )),
                    Value::Tuple(_) => current::CodeRunResult::Err(current::RunError {
                        span: None,
                        msg: current::RunErrorMsg::Unexpected("tuple as cell output".into()),
                    }),
                },
                CodeRunResult::Err(error) => current::CodeRunResult::Err(
                    current::RunError::from_grid_run_error(error.to_owned()),
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
                    return_type: code_run.return_type.clone(),
                    line_number: code_run.line_number,
                    output_type: code_run.output_type.clone(),
                },
            )
        })
        .collect()
}

pub(crate) fn export_sheet(sheet: Sheet) -> current::Sheet {
    current::Sheet {
        id: current::Id {
            id: sheet.id.to_string(),
        },
        name: sheet.name.to_owned(),
        color: sheet.color.to_owned(),
        order: sheet.order.to_owned(),
        offsets: sheet.offsets.export(),
        borders: export_borders_builder(&sheet),
        formats_all: sheet.format_all.as_ref().and_then(export_format),
        formats_columns: export_formats(&sheet.formats_columns),
        formats_rows: export_formats(&sheet.formats_rows),
        rows_resize: export_rows_size(&sheet),
        code_runs: export_rows_code_runs(&sheet),
        columns: export_column_builder(sheet),
    }
}

pub fn export(grid: Grid) -> Result<current::GridSchema> {
    Ok(current::GridSchema {
        version: Some(CURRENT_VERSION.into()),
        sheets: grid.sheets.into_iter().map(export_sheet).collect(),
    })
}
