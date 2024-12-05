use crate::grid::{
    contiguous::Block,
    formats::Format,
    resize::{Resize, ResizeMap},
    CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat, NumericFormatKind,
    RenderSize, SheetFormatting,
};

use super::current;

/// Converts a `T -> U` function to `Option<T> -> Option<U>`
fn opt<T, U>(f: impl Fn(T) -> U) -> impl Fn(Option<T>) -> Option<U> {
    move |x| x.map(&f)
}

fn import_cell_align(align: current::CellAlignSchema) -> CellAlign {
    match align {
        current::CellAlignSchema::Left => CellAlign::Left,
        current::CellAlignSchema::Center => CellAlign::Center,
        current::CellAlignSchema::Right => CellAlign::Right,
    }
}

fn import_cell_vertical_align(
    vertical_align: current::CellVerticalAlignSchema,
) -> CellVerticalAlign {
    match vertical_align {
        current::CellVerticalAlignSchema::Top => CellVerticalAlign::Top,
        current::CellVerticalAlignSchema::Middle => CellVerticalAlign::Middle,
        current::CellVerticalAlignSchema::Bottom => CellVerticalAlign::Bottom,
    }
}

fn import_cell_wrap(wrap: current::CellWrapSchema) -> CellWrap {
    match wrap {
        current::CellWrapSchema::Wrap => CellWrap::Wrap,
        current::CellWrapSchema::Overflow => CellWrap::Overflow,
        current::CellWrapSchema::Clip => CellWrap::Clip,
    }
}

fn import_numeric_format(numeric_format: current::NumericFormatSchema) -> NumericFormat {
    NumericFormat {
        kind: match numeric_format.kind {
            current::NumericFormatKindSchema::Number => NumericFormatKind::Number,
            current::NumericFormatKindSchema::Currency => NumericFormatKind::Currency,
            current::NumericFormatKindSchema::Percentage => NumericFormatKind::Percentage,
            current::NumericFormatKindSchema::Exponential => NumericFormatKind::Exponential,
        },
        symbol: numeric_format.symbol,
    }
}

fn import_render_size(render_size: current::RenderSizeSchema) -> RenderSize {
    RenderSize {
        w: render_size.w,
        h: render_size.h,
    }
}

fn import_contiguous_2d<C: Clone, F, T: Default + Clone + PartialEq>(
    blocks: current::Contiguous2DSchema<C>,
    f: F,
) -> Contiguous2D<T>
where
    F: Fn(C) -> T,
{
    let mut ret = Contiguous2D::new();
    for x_block in blocks {
        ret.raw_set_xy_blocks(Block {
            start: x_block.start,
            end: x_block.end,
            value: x_block.value.into_iter().map(|y_block| Block {
                start: y_block.start,
                end: y_block.end,
                value: f(y_block.value),
            }),
        })
    }
    ret
}

pub(crate) fn import_formats(formats: current::SheetFormattingSchema) -> SheetFormatting {
    SheetFormatting {
        align: import_contiguous_2d(formats.align, opt(import_cell_align)),
        vertical_align: import_contiguous_2d(
            formats.vertical_align,
            opt(import_cell_vertical_align),
        ),
        wrap: import_contiguous_2d(formats.wrap, opt(import_cell_wrap)),
        numeric_format: import_contiguous_2d(formats.numeric_format, opt(import_numeric_format)),
        numeric_decimals: import_contiguous_2d(formats.numeric_decimals, |x| x),
        numeric_commas: import_contiguous_2d(formats.numeric_commas, |x| x),
        bold: import_contiguous_2d(formats.bold, |x| x),
        italic: import_contiguous_2d(formats.italic, |x| x),
        text_color: import_contiguous_2d(formats.text_color, |x| x),
        fill_color: import_contiguous_2d(formats.fill_color, |x| x),
        render_size: import_contiguous_2d(formats.render_size, opt(import_render_size)),
        date_time: import_contiguous_2d(formats.date_time, |x| x),
        underline: import_contiguous_2d(formats.underline, |x| x),
        strike_through: import_contiguous_2d(formats.strike_through, |x| x),
    }
}

fn export_cell_align(align: CellAlign) -> current::CellAlignSchema {
    match align {
        CellAlign::Left => current::CellAlignSchema::Left,
        CellAlign::Center => current::CellAlignSchema::Center,
        CellAlign::Right => current::CellAlignSchema::Right,
    }
}

fn export_cell_vertical_align(
    vertical_align: CellVerticalAlign,
) -> current::CellVerticalAlignSchema {
    match vertical_align {
        CellVerticalAlign::Top => current::CellVerticalAlignSchema::Top,
        CellVerticalAlign::Middle => current::CellVerticalAlignSchema::Middle,
        CellVerticalAlign::Bottom => current::CellVerticalAlignSchema::Bottom,
    }
}

fn export_cell_wrap(wrap: CellWrap) -> current::CellWrapSchema {
    match wrap {
        CellWrap::Wrap => current::CellWrapSchema::Wrap,
        CellWrap::Overflow => current::CellWrapSchema::Overflow,
        CellWrap::Clip => current::CellWrapSchema::Clip,
    }
}

fn export_numeric_format(numeric_format: NumericFormat) -> current::NumericFormatSchema {
    current::NumericFormatSchema {
        kind: match numeric_format.kind {
            NumericFormatKind::Number => current::NumericFormatKindSchema::Number,
            NumericFormatKind::Currency => current::NumericFormatKindSchema::Currency,
            NumericFormatKind::Percentage => current::NumericFormatKindSchema::Percentage,
            NumericFormatKind::Exponential => current::NumericFormatKindSchema::Exponential,
        },
        symbol: numeric_format.symbol,
    }
}

fn export_render_size(render_size: RenderSize) -> current::RenderSizeSchema {
    current::RenderSizeSchema {
        w: render_size.w,
        h: render_size.h,
    }
}

fn export_contiguous_2d<T: Default + Clone + PartialEq, F, C>(
    blocks: Contiguous2D<T>,
    f: F,
) -> current::Contiguous2DSchema<C>
where
    F: Fn(T) -> C,
{
    blocks
        .xy_blocks()
        .map(|x_block| current::BlockSchema {
            start: x_block.start,
            end: x_block.end,
            value: x_block
                .value
                .into_iter()
                .map(|y_block| current::BlockSchema {
                    start: y_block.start,
                    end: y_block.end,
                    value: f(y_block.value.clone()),
                })
                .collect(),
        })
        .collect()
}

pub(crate) fn export_formats(formats: SheetFormatting) -> current::SheetFormattingSchema {
    current::SheetFormattingSchema {
        align: export_contiguous_2d(formats.align, opt(export_cell_align)),
        vertical_align: export_contiguous_2d(
            formats.vertical_align,
            opt(export_cell_vertical_align),
        ),
        wrap: export_contiguous_2d(formats.wrap, opt(export_cell_wrap)),
        numeric_format: export_contiguous_2d(formats.numeric_format, opt(export_numeric_format)),
        numeric_decimals: export_contiguous_2d(formats.numeric_decimals, |x| x),
        numeric_commas: export_contiguous_2d(formats.numeric_commas, |x| x),
        bold: export_contiguous_2d(formats.bold, |x| x),
        italic: export_contiguous_2d(formats.italic, |x| x),
        text_color: export_contiguous_2d(formats.text_color, |x| x),
        fill_color: export_contiguous_2d(formats.fill_color, |x| x),
        render_size: export_contiguous_2d(formats.render_size, opt(export_render_size)),
        date_time: export_contiguous_2d(formats.date_time, |x| x),
        underline: export_contiguous_2d(formats.underline, |x| x),
        strike_through: export_contiguous_2d(formats.strike_through, |x| x),
    }
}
