use std::collections::HashMap;

use super::{
    contiguous_2d::{export_contiguous_2d, import_contiguous_2d, opt_fn},
    current,
};

use crate::{
    color::Rgba,
    grid::{
        block::SameValue,
        sheet::borders_a1::{BorderStyleCell, BorderStyleTimestamp, BordersA1, CellBorderLine},
        Contiguous2D,
    },
    small_timestamp::SmallTimestamp,
};

fn import_rgba(schema: current::RgbaSchema) -> Rgba {
    Rgba {
        red: schema.red,
        green: schema.green,
        blue: schema.blue,
        alpha: schema.alpha,
    }
}

fn import_border_line(schema: current::CellBorderLineSchema) -> CellBorderLine {
    match schema {
        current::CellBorderLineSchema::Line1 => CellBorderLine::Line1,
        current::CellBorderLineSchema::Line2 => CellBorderLine::Line2,
        current::CellBorderLineSchema::Line3 => CellBorderLine::Line3,
        current::CellBorderLineSchema::Dotted => CellBorderLine::Dotted,
        current::CellBorderLineSchema::Dashed => CellBorderLine::Dashed,
        current::CellBorderLineSchema::Double => CellBorderLine::Double,
        current::CellBorderLineSchema::Clear => CellBorderLine::Clear,
    }
}

fn import_timestamp(value: u32) -> SmallTimestamp {
    SmallTimestamp::new(value)
}

fn import_border_style_timestamp(
    schema: current::BorderStyleTimestampSchema,
) -> BorderStyleTimestamp {
    BorderStyleTimestamp {
        color: import_rgba(schema.color),
        line: import_border_line(schema.line),
        timestamp: import_timestamp(schema.timestamp),
    }
}

pub(crate) fn import_borders(borders: current::BordersA1Schema) -> BordersA1 {
    BordersA1 {
        left: import_contiguous_2d(borders.left, opt_fn(import_border_style_timestamp)),
        right: import_contiguous_2d(borders.right, opt_fn(import_border_style_timestamp)),
        top: import_contiguous_2d(borders.top, opt_fn(import_border_style_timestamp)),
        bottom: import_contiguous_2d(borders.bottom, opt_fn(import_border_style_timestamp)),
    }
}

fn export_rgba(color: Rgba) -> current::RgbaSchema {
    current::RgbaSchema {
        red: color.red,
        green: color.green,
        blue: color.blue,
        alpha: color.alpha,
    }
}

fn export_border_style(line: CellBorderLine) -> current::CellBorderLineSchema {
    match line {
        CellBorderLine::Line1 => current::CellBorderLineSchema::Line1,
        CellBorderLine::Line2 => current::CellBorderLineSchema::Line2,
        CellBorderLine::Line3 => current::CellBorderLineSchema::Line3,
        CellBorderLine::Dotted => current::CellBorderLineSchema::Dotted,
        CellBorderLine::Dashed => current::CellBorderLineSchema::Dashed,
        CellBorderLine::Double => current::CellBorderLineSchema::Double,
        CellBorderLine::Clear => current::CellBorderLineSchema::Clear,
    }
}

fn export_timestamp(timestamp: SmallTimestamp) -> u32 {
    timestamp.value()
}

fn export_border_style_timestamp(
    style: BorderStyleTimestamp,
) -> current::BorderStyleTimestampSchema {
    current::BorderStyleTimestampSchema {
        color: export_rgba(style.color),
        line: export_border_style(style.line),
        timestamp: export_timestamp(style.timestamp),
    }
}

fn export_border_side(
    side: Contiguous2D<Option<BorderStyleTimestamp>>,
) -> current::BordersA1SideSchema {
    export_contiguous_2d(side, |border_style_timestamp| {
        border_style_timestamp.map(export_border_style_timestamp)
    })
}

pub(crate) fn export_borders(borders_a1: BordersA1) -> current::BordersA1Schema {
    current::BordersA1Schema {
        left: export_border_side(borders_a1.left),
        right: export_border_side(borders_a1.right),
        top: export_border_side(borders_a1.top),
        bottom: export_border_side(borders_a1.bottom),
    }
}
