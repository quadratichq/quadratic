use std::collections::{BTreeMap, HashMap};

use anyhow::Result;

use crate::{
    grid::{
        block::SameValue, CellAlign, CellVerticalAlign, CellWrap, Column, ColumnData,
        NumericFormat, NumericFormatKind, RenderSize,
    },
    CellValue,
};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
};

pub(crate) fn set_column_format_align(
    column_data: &mut ColumnData<SameValue<CellAlign>>,
    column: HashMap<String, current::ColumnRepeatSchema<current::CellAlignSchema>>,
) {
    for (y, format) in column.into_iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(match format.value {
                    current::CellAlignSchema::Left => CellAlign::Left,
                    current::CellAlignSchema::Center => CellAlign::Center,
                    current::CellAlignSchema::Right => CellAlign::Right,
                }),
            );
        }
    }
}

pub(crate) fn set_column_format_vertical_align(
    column_data: &mut ColumnData<SameValue<CellVerticalAlign>>,
    column: HashMap<String, current::ColumnRepeatSchema<current::CellVerticalAlignSchema>>,
) {
    for (y, format) in column.into_iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(match format.value {
                    current::CellVerticalAlignSchema::Top => CellVerticalAlign::Top,
                    current::CellVerticalAlignSchema::Middle => CellVerticalAlign::Middle,
                    current::CellVerticalAlignSchema::Bottom => CellVerticalAlign::Bottom,
                }),
            );
        }
    }
}

pub(crate) fn set_column_format_wrap(
    column_data: &mut ColumnData<SameValue<CellWrap>>,
    column: HashMap<String, current::ColumnRepeatSchema<current::CellWrapSchema>>,
) {
    for (y, format) in column.into_iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(match format.value {
                    current::CellWrapSchema::Wrap => CellWrap::Wrap,
                    current::CellWrapSchema::Overflow => CellWrap::Overflow,
                    current::CellWrapSchema::Clip => CellWrap::Clip,
                }),
            );
        }
    }
}

pub(crate) fn set_column_format_numeric_format(
    column_data: &mut ColumnData<SameValue<NumericFormat>>,
    column: HashMap<String, current::ColumnRepeatSchema<current::NumericFormatSchema>>,
) {
    for (y, format) in column.into_iter() {
        // there's probably a better way to do this...
        let y = (y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(
                y,
                Some(NumericFormat {
                    kind: match format.value.kind {
                        current::NumericFormatKindSchema::Number => NumericFormatKind::Number,
                        current::NumericFormatKindSchema::Currency => NumericFormatKind::Currency,
                        current::NumericFormatKindSchema::Percentage => {
                            NumericFormatKind::Percentage
                        }
                        current::NumericFormatKindSchema::Exponential => {
                            NumericFormatKind::Exponential
                        }
                    },
                    symbol: format.value.symbol.clone(),
                }),
            );
        }
    }
}

pub(crate) fn set_column_format_i16(
    column_data: &mut ColumnData<SameValue<i16>>,
    column: HashMap<String, current::ColumnRepeatSchema<i16>>,
) {
    for (y, format) in column.into_iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(y, Some(format.value));
        }
    }
}

pub(crate) fn set_column_format_string(
    column_data: &mut ColumnData<SameValue<String>>,
    column: HashMap<String, current::ColumnRepeatSchema<String>>,
) {
    for (y, format) in column.into_iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(y, Some(format.value.clone()));
        }
    }
}

pub(crate) fn set_column_format_bool(
    column_data: &mut ColumnData<SameValue<bool>>,
    column: HashMap<String, current::ColumnRepeatSchema<bool>>,
) {
    for (y, format) in column.into_iter() {
        // there's probably a better way to do this...
        let y = (*y).parse::<i64>().unwrap();
        for y in y..(y + format.len as i64) {
            column_data.set(y, Some(format.value));
        }
    }
}

pub(crate) fn set_column_format_render_size(
    column_data: &mut ColumnData<SameValue<RenderSize>>,
    column: HashMap<String, current::ColumnRepeatSchema<current::RenderSizeSchema>>,
) {
    for (y, format) in column.into_iter() {
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

pub(crate) fn import_column_builder(
    columns: Vec<(i64, current::ColumnSchema)>,
) -> Result<BTreeMap<i64, Column>> {
    columns
        .into_iter()
        .map(|(x, column)| {
            let mut col = Column::new(x);
            set_column_format_align(&mut col.align, column.align);
            set_column_format_vertical_align(&mut col.vertical_align, column.vertical_align);
            set_column_format_wrap(&mut col.wrap, column.wrap);
            set_column_format_i16(&mut col.numeric_decimals, column.numeric_decimals);
            set_column_format_numeric_format(&mut col.numeric_format, column.numeric_format);
            set_column_format_bool(&mut col.numeric_commas, column.numeric_commas);
            set_column_format_bool(&mut col.bold, column.bold);
            set_column_format_bool(&mut col.italic, column.italic);
            set_column_format_bool(&mut col.underline, column.underline);
            set_column_format_bool(&mut col.strike_through, column.strike_through);
            set_column_format_string(&mut col.text_color, column.text_color);
            set_column_format_string(&mut col.fill_color, column.fill_color);
            set_column_format_render_size(&mut col.render_size, column.render_size);
            set_column_format_string(&mut col.date_time, column.date_time);

            // todo: there's probably a better way of doing this
            for (y, value) in column.values.into_iter() {
                let cell_value = import_cell_value(value);
                if let Ok(y) = y.parse::<i64>() {
                    col.values.insert(y, cell_value);
                }
            }

            Ok((x, col))
        })
        .collect::<Result<BTreeMap<i64, Column>>>()
}

pub(crate) fn export_column_data_bool(
    column_data: ColumnData<SameValue<bool>>,
) -> HashMap<String, current::ColumnRepeatSchema<bool>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: block.content.value,
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

pub(crate) fn export_column_data_string(
    column_data: ColumnData<SameValue<String>>,
) -> HashMap<String, current::ColumnRepeatSchema<String>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: block.content.value.clone(),
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

pub(crate) fn export_column_data_i16(
    column_data: ColumnData<SameValue<i16>>,
) -> HashMap<String, current::ColumnRepeatSchema<i16>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: block.content.value,
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

pub(crate) fn export_column_data_numeric_format(
    column_data: ColumnData<SameValue<NumericFormat>>,
) -> HashMap<String, current::ColumnRepeatSchema<current::NumericFormatSchema>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: current::NumericFormatSchema {
                        kind: match block.content.value.kind {
                            NumericFormatKind::Number => current::NumericFormatKindSchema::Number,
                            NumericFormatKind::Currency => {
                                current::NumericFormatKindSchema::Currency
                            }
                            NumericFormatKind::Percentage => {
                                current::NumericFormatKindSchema::Percentage
                            }
                            NumericFormatKind::Exponential => {
                                current::NumericFormatKindSchema::Exponential
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

pub(crate) fn export_column_data_render_size(
    column_data: ColumnData<SameValue<RenderSize>>,
) -> HashMap<String, current::ColumnRepeatSchema<current::RenderSizeSchema>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: current::RenderSizeSchema {
                        w: block.content.value.w.clone(),
                        h: block.content.value.h.clone(),
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

pub(crate) fn export_column_data_align(
    column_data: ColumnData<SameValue<CellAlign>>,
) -> HashMap<String, current::ColumnRepeatSchema<current::CellAlignSchema>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: match block.content.value {
                        CellAlign::Left => current::CellAlignSchema::Left,
                        CellAlign::Center => current::CellAlignSchema::Center,
                        CellAlign::Right => current::CellAlignSchema::Right,
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

pub(crate) fn export_column_data_vertical_align(
    column_data: ColumnData<SameValue<CellVerticalAlign>>,
) -> HashMap<String, current::ColumnRepeatSchema<current::CellVerticalAlignSchema>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: match block.content.value {
                        CellVerticalAlign::Top => current::CellVerticalAlignSchema::Top,
                        CellVerticalAlign::Middle => current::CellVerticalAlignSchema::Middle,
                        CellVerticalAlign::Bottom => current::CellVerticalAlignSchema::Bottom,
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

pub(crate) fn export_column_data_wrap(
    column_data: ColumnData<SameValue<CellWrap>>,
) -> HashMap<String, current::ColumnRepeatSchema<current::CellWrapSchema>> {
    column_data
        .into_blocks()
        .map(|block| {
            (
                block.y.to_string(),
                current::ColumnRepeatSchema {
                    value: match block.content.value {
                        CellWrap::Wrap => current::CellWrapSchema::Wrap,
                        CellWrap::Overflow => current::CellWrapSchema::Overflow,
                        CellWrap::Clip => current::CellWrapSchema::Clip,
                    },
                    len: block.len() as u32,
                },
            )
        })
        .collect()
}

pub(crate) fn export_values(
    values: BTreeMap<i64, CellValue>,
) -> HashMap<String, current::CellValueSchema> {
    values
        .into_iter()
        .map(|(y, value)| (y.to_string(), export_cell_value(value)))
        .collect()
}

pub(crate) fn export_column_builder(
    columns: BTreeMap<i64, Column>,
) -> Vec<(i64, current::ColumnSchema)> {
    columns
        .into_iter()
        .map(|(x, column)| {
            (
                x,
                current::ColumnSchema {
                    align: export_column_data_align(column.align),
                    vertical_align: export_column_data_vertical_align(column.vertical_align),
                    wrap: export_column_data_wrap(column.wrap),
                    numeric_decimals: export_column_data_i16(column.numeric_decimals),
                    numeric_format: export_column_data_numeric_format(column.numeric_format),
                    numeric_commas: export_column_data_bool(column.numeric_commas),
                    bold: export_column_data_bool(column.bold),
                    italic: export_column_data_bool(column.italic),
                    underline: export_column_data_bool(column.underline),
                    strike_through: export_column_data_bool(column.strike_through),
                    text_color: export_column_data_string(column.text_color),
                    fill_color: export_column_data_string(column.fill_color),
                    render_size: export_column_data_render_size(column.render_size),
                    date_time: export_column_data_string(column.date_time),
                    values: export_values(column.values),
                },
            )
        })
        .collect()
}
