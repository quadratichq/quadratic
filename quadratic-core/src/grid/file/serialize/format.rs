use anyhow::Result;
use std::collections::BTreeMap;

use crate::grid::{
    formats::format::Format,
    resize::{Resize, ResizeMap},
    CellAlign, CellVerticalAlign, CellWrap, NumericFormat, NumericFormatKind, RenderSize,
};

use super::current;

pub(crate) fn import_format(format: current::FormatSchema) -> Format {
    Format {
        align: format.align.map(|align| match align {
            current::CellAlignSchema::Left => CellAlign::Left,
            current::CellAlignSchema::Center => CellAlign::Center,
            current::CellAlignSchema::Right => CellAlign::Right,
        }),
        vertical_align: format
            .vertical_align
            .map(|vertical_align| match vertical_align {
                current::CellVerticalAlignSchema::Top => CellVerticalAlign::Top,
                current::CellVerticalAlignSchema::Middle => CellVerticalAlign::Middle,
                current::CellVerticalAlignSchema::Bottom => CellVerticalAlign::Bottom,
            }),
        wrap: format.wrap.map(|wrap| match wrap {
            current::CellWrapSchema::Wrap => CellWrap::Wrap,
            current::CellWrapSchema::Overflow => CellWrap::Overflow,
            current::CellWrapSchema::Clip => CellWrap::Clip,
        }),
        numeric_format: format.numeric_format.map(|numeric_format| NumericFormat {
            kind: match numeric_format.kind {
                current::NumericFormatKindSchema::Number => NumericFormatKind::Number,
                current::NumericFormatKindSchema::Currency => NumericFormatKind::Currency,
                current::NumericFormatKindSchema::Percentage => NumericFormatKind::Percentage,
                current::NumericFormatKindSchema::Exponential => NumericFormatKind::Exponential,
            },
            symbol: numeric_format.symbol,
        }),
        numeric_decimals: format.numeric_decimals,
        numeric_commas: format.numeric_commas,
        bold: format.bold,
        italic: format.italic,
        text_color: format.text_color,
        fill_color: format.fill_color,
        render_size: format.render_size.map(|render_size| RenderSize {
            w: render_size.w,
            h: render_size.h,
        }),
        date_time: format.date_time,
        underline: format.underline,
        strike_through: format.strike_through,
    }
}

pub(crate) fn import_formats(
    format: Vec<(i64, (current::FormatSchema, i64))>,
) -> BTreeMap<i64, (Format, i64)> {
    format
        .into_iter()
        .map(|(i, (format, timestamp))| (i, (import_format(format), timestamp)))
        .collect()
}

pub(crate) fn import_rows_size(row_sizes: Vec<(i64, current::ResizeSchema)>) -> Result<ResizeMap> {
    row_sizes
        .into_iter()
        .try_fold(ResizeMap::default(), |mut sizes, (y, size)| {
            sizes.set_resize(
                y,
                match size {
                    current::ResizeSchema::Auto => Resize::Auto,
                    current::ResizeSchema::Manual => Resize::Manual,
                },
            );
            Ok(sizes)
        })
}

pub(crate) fn export_format(format: Format) -> Option<current::FormatSchema> {
    if format.is_default() {
        None
    } else {
        Some(current::FormatSchema {
            align: format.align.map(|align| match align {
                CellAlign::Left => current::CellAlignSchema::Left,
                CellAlign::Center => current::CellAlignSchema::Center,
                CellAlign::Right => current::CellAlignSchema::Right,
            }),
            vertical_align: format
                .vertical_align
                .map(|vertical_align| match vertical_align {
                    CellVerticalAlign::Top => current::CellVerticalAlignSchema::Top,
                    CellVerticalAlign::Middle => current::CellVerticalAlignSchema::Middle,
                    CellVerticalAlign::Bottom => current::CellVerticalAlignSchema::Bottom,
                }),
            wrap: format.wrap.map(|wrap| match wrap {
                CellWrap::Wrap => current::CellWrapSchema::Wrap,
                CellWrap::Overflow => current::CellWrapSchema::Overflow,
                CellWrap::Clip => current::CellWrapSchema::Clip,
            }),
            numeric_format: format.numeric_format.map(|numeric_format| {
                current::NumericFormatSchema {
                    kind: match numeric_format.kind {
                        NumericFormatKind::Number => current::NumericFormatKindSchema::Number,
                        NumericFormatKind::Currency => current::NumericFormatKindSchema::Currency,
                        NumericFormatKind::Percentage => {
                            current::NumericFormatKindSchema::Percentage
                        }
                        NumericFormatKind::Exponential => {
                            current::NumericFormatKindSchema::Exponential
                        }
                    },
                    symbol: numeric_format.symbol,
                }
            }),
            numeric_decimals: format.numeric_decimals,
            numeric_commas: format.numeric_commas,
            bold: format.bold,
            italic: format.italic,
            text_color: format.text_color,
            fill_color: format.fill_color,
            render_size: format
                .render_size
                .map(|render_size| current::RenderSizeSchema {
                    w: render_size.w,
                    h: render_size.h,
                }),
            date_time: format.date_time,
            underline: format.underline,
            strike_through: format.strike_through,
        })
    }
}

pub(crate) fn export_formats(
    formats: BTreeMap<i64, (Format, i64)>,
) -> Vec<(i64, (current::FormatSchema, i64))> {
    formats
        .into_iter()
        .filter_map(|(y, (format, timestamp))| {
            let f = export_format(format)?;
            Some((y, (f, timestamp)))
        })
        .collect()
}

pub(crate) fn export_rows_size(rows_resize: ResizeMap) -> Vec<(i64, current::ResizeSchema)> {
    rows_resize
        .into_iter_resize()
        .map(|(y, resize)| {
            (
                y,
                match resize {
                    Resize::Auto => current::ResizeSchema::Auto,
                    Resize::Manual => current::ResizeSchema::Manual,
                },
            )
        })
        .collect()
}
