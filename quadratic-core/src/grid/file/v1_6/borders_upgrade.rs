use std::collections::HashMap;

use crate::{
    color::Rgba,
    grid::{
        block::SameValue,
        column::ColumnData,
        file::v1_7,
        sheet::borders::{
            BorderStyleCell, BorderStyleTimestamp, CellBorderLine, borders_old::OldBorders,
        },
    },
    small_timestamp::SmallTimestamp,
};

fn export_rgba(color: Rgba) -> v1_7::schema::RgbaSchema {
    v1_7::schema::RgbaSchema {
        red: color.red,
        green: color.green,
        blue: color.blue,
        alpha: color.alpha,
    }
}

fn export_border_line(line: CellBorderLine) -> v1_7::schema::CellBorderLineSchema {
    match line {
        CellBorderLine::Line1 => v1_7::schema::CellBorderLineSchema::Line1,
        CellBorderLine::Line2 => v1_7::schema::CellBorderLineSchema::Line2,
        CellBorderLine::Line3 => v1_7::schema::CellBorderLineSchema::Line3,
        CellBorderLine::Dotted => v1_7::schema::CellBorderLineSchema::Dotted,
        CellBorderLine::Dashed => v1_7::schema::CellBorderLineSchema::Dashed,
        CellBorderLine::Double => v1_7::schema::CellBorderLineSchema::Double,
        CellBorderLine::Clear => v1_7::schema::CellBorderLineSchema::Clear,
    }
}

fn export_timestamp(timestamp: SmallTimestamp) -> u32 {
    timestamp.value()
}

fn export_border_style_cell(style: BorderStyleCell) -> v1_7::schema::BorderStyleCellSchema {
    v1_7::schema::BorderStyleCellSchema {
        top: style.top.map(export_border_style_timestamp),
        bottom: style.bottom.map(export_border_style_timestamp),
        left: style.left.map(export_border_style_timestamp),
        right: style.right.map(export_border_style_timestamp),
    }
}

fn export_border_style_timestamp(
    style: BorderStyleTimestamp,
) -> v1_7::schema::BorderStyleTimestampSchema {
    v1_7::schema::BorderStyleTimestampSchema {
        color: export_rgba(style.color),
        line: export_border_line(style.line),
        timestamp: export_timestamp(style.timestamp),
    }
}

fn export_column_repeat(
    data: ColumnData<SameValue<BorderStyleTimestamp>>,
) -> HashMap<i64, v1_7::schema::ColumnRepeatSchema<v1_7::schema::BorderStyleTimestampSchema>> {
    data.blocks()
        .map(|block| {
            let start = block.start();
            let value = export_border_style_timestamp(block.content.value);
            let len = block.content.len as u32;
            (start, v1_7::schema::ColumnRepeatSchema { value, len })
        })
        .collect()
}

fn export_border_side(
    data: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
) -> HashMap<
    i64,
    HashMap<i64, v1_7::schema::ColumnRepeatSchema<v1_7::schema::BorderStyleTimestampSchema>>,
> {
    data.into_iter()
        .map(|(col, data)| (col, export_column_repeat(data)))
        .collect()
}

fn export_hash_map_border_style_cell(
    data: HashMap<i64, BorderStyleCell>,
) -> HashMap<i64, v1_7::schema::BorderStyleCellSchema> {
    data.into_iter()
        .map(|(i, style)| (i, export_border_style_cell(style)))
        .collect()
}

pub fn export_borders(borders: OldBorders) -> v1_7::schema::BordersSchema {
    v1_7::schema::BordersSchema {
        all: export_border_style_cell(borders.all),
        columns: export_hash_map_border_style_cell(borders.columns),
        rows: export_hash_map_border_style_cell(borders.rows),

        left: export_border_side(borders.left),
        right: export_border_side(borders.right),
        top: export_border_side(borders.top),
        bottom: export_border_side(borders.bottom),
    }
}
