use anyhow::Result;
use std::collections::BTreeMap;

use crate::grid::{
    contiguous::Block,
    file::v1_7_1::BlockSchema,
    formats::format::Format,
    resize::{Resize, ResizeMap},
    CellAlign, CellVerticalAlign, CellWrap, NumericFormat, NumericFormatKind, RenderSize,
    SheetFormatting,
};

use super::current::{self, FormatSchema, SheetFormattingSchema};

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

pub(crate) fn import_formats(formats: SheetFormattingSchema) -> SheetFormatting {
    formats
        .into_iter()
        .map(|(x, block)| {
            (
                x,
                Block {
                    start: block.start,
                    end: block.end,
                    value: block
                        .value
                        .into_iter()
                        .map(|(y, block)| {
                            (
                                y,
                                Block {
                                    start: block.start,
                                    end: block.end,
                                    value: import_format(block.value),
                                },
                            )
                        })
                        .collect(),
                },
            )
        })
        .collect()
}

pub(crate) fn export_format(format: Format) -> current::FormatSchema {
    current::FormatSchema {
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
        numeric_format: format
            .numeric_format
            .map(|numeric_format| current::NumericFormatSchema {
                kind: match numeric_format.kind {
                    NumericFormatKind::Number => current::NumericFormatKindSchema::Number,
                    NumericFormatKind::Currency => current::NumericFormatKindSchema::Currency,
                    NumericFormatKind::Percentage => current::NumericFormatKindSchema::Percentage,
                    NumericFormatKind::Exponential => current::NumericFormatKindSchema::Exponential,
                },
                symbol: numeric_format.symbol,
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
    }
}

pub(crate) fn export_formats(formats: SheetFormatting) -> SheetFormattingSchema {
    formats
        .into_iter()
        .map(|(x, block)| {
            (
                x,
                BlockSchema {
                    start: block.start,
                    end: block.end,
                    value: block
                        .value
                        .into_iter()
                        .map(|(y, format)| {
                            (
                                y,
                                BlockSchema {
                                    start: format.start,
                                    end: format.end,
                                    value: export_format(format.value),
                                },
                            )
                        })
                        .collect(),
                },
            )
        })
        .collect()
}
