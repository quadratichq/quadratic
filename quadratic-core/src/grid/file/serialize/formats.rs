use crate::grid::{
    CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, NumericFormat, NumericFormatKind,
    SheetFormatting,
    contiguous::Block,
    formats::Format,
    formatting::RenderSize,
    resize::{Resize, ResizeMap},
};

use super::{
    contiguous_2d::{export_contiguous_2d, import_contiguous_2d, opt_fn},
    current,
};

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

pub(crate) fn import_formats(formats: current::SheetFormattingSchema) -> SheetFormatting {
    SheetFormatting {
        align: import_contiguous_2d(formats.align, opt_fn(import_cell_align)),
        vertical_align: import_contiguous_2d(
            formats.vertical_align,
            opt_fn(import_cell_vertical_align),
        ),
        wrap: import_contiguous_2d(formats.wrap, opt_fn(import_cell_wrap)),
        numeric_format: import_contiguous_2d(formats.numeric_format, opt_fn(import_numeric_format)),
        numeric_decimals: import_contiguous_2d(formats.numeric_decimals, |x| x),
        numeric_commas: import_contiguous_2d(formats.numeric_commas, |x| x),
        bold: import_contiguous_2d(formats.bold, |x| x),
        italic: import_contiguous_2d(formats.italic, |x| x),
        text_color: import_contiguous_2d(formats.text_color, |x| x),
        fill_color: import_contiguous_2d(formats.fill_color, |x| x),
        date_time: import_contiguous_2d(formats.date_time, |x| x),
        underline: import_contiguous_2d(formats.underline, |x| x),
        strike_through: import_contiguous_2d(formats.strike_through, |x| x),
        font_size: import_contiguous_2d(formats.font_size, |x| x),
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

// TODO(ddimaria):  v1_8::schema: should be current, update
pub(crate) fn export_formats(formats: SheetFormatting) -> current::SheetFormattingSchema {
    current::SheetFormattingSchema {
        align: export_contiguous_2d(formats.align, opt_fn(export_cell_align)),
        vertical_align: export_contiguous_2d(
            formats.vertical_align,
            opt_fn(export_cell_vertical_align),
        ),
        wrap: export_contiguous_2d(formats.wrap, opt_fn(export_cell_wrap)),
        numeric_format: export_contiguous_2d(formats.numeric_format, opt_fn(export_numeric_format)),
        numeric_decimals: export_contiguous_2d(formats.numeric_decimals, |x| x),
        numeric_commas: export_contiguous_2d(formats.numeric_commas, |x| x),
        bold: export_contiguous_2d(formats.bold, |x| x),
        italic: export_contiguous_2d(formats.italic, |x| x),
        text_color: export_contiguous_2d(formats.text_color, |x| x),
        fill_color: export_contiguous_2d(formats.fill_color, |x| x),
        date_time: export_contiguous_2d(formats.date_time, |x| x),
        underline: export_contiguous_2d(formats.underline, |x| x),
        strike_through: export_contiguous_2d(formats.strike_through, |x| x),
        font_size: export_contiguous_2d(formats.font_size, |x| x),
    }
}
