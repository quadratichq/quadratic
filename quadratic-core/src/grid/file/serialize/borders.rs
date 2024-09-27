use std::collections::HashMap;

use super::current;

use crate::{
    color::Rgba,
    grid::{
        block::SameValue,
        sheet::borders::{BorderStyleCell, BorderStyleTimestamp, Borders},
        CellBorderLine, ColumnData,
    },
    small_timestamp::SmallTimestamp,
};

fn export_rgba(color: Rgba) -> current::RgbaSchema {
    current::RgbaSchema {
        red: color.red,
        green: color.green,
        blue: color.blue,
        alpha: color.alpha,
    }
}

fn export_border_line(line: CellBorderLine) -> current::CellBorderLineSchema {
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

fn export_border_style_cell(style: BorderStyleCell) -> current::BorderStyleCellSchema {
    current::BorderStyleCellSchema {
        top: style.top.map(export_border_style_timestamp),
        bottom: style.bottom.map(export_border_style_timestamp),
        left: style.left.map(export_border_style_timestamp),
        right: style.right.map(export_border_style_timestamp),
    }
}

fn export_border_style_timestamp(
    style: BorderStyleTimestamp,
) -> current::BorderStyleTimestampSchema {
    current::BorderStyleTimestampSchema {
        color: export_rgba(style.color),
        line: export_border_line(style.line),
        timestamp: export_timestamp(style.timestamp),
    }
}

fn export_column_repeat(
    data: ColumnData<SameValue<BorderStyleTimestamp>>,
) -> HashMap<i64, current::ColumnRepeatSchema<current::BorderStyleTimestampSchema>> {
    data.blocks()
        .map(|block| {
            let start = block.start();
            let value = export_border_style_timestamp(block.content.value);
            let len = block.content.len as u32;
            (start, current::ColumnRepeatSchema { value, len })
        })
        .collect()
}

fn export_border_side(
    data: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
) -> HashMap<i64, HashMap<i64, current::ColumnRepeatSchema<current::BorderStyleTimestampSchema>>> {
    data.into_iter()
        .map(|(col, data)| (col, export_column_repeat(data)))
        .collect()
}

fn export_hash_map_border_style_cell(
    data: HashMap<i64, BorderStyleCell>,
) -> HashMap<i64, current::BorderStyleCellSchema> {
    data.into_iter()
        .map(|(i, style)| (i, export_border_style_cell(style)))
        .collect()
}

pub fn export_borders(borders: Borders) -> current::BordersSchema {
    current::BordersSchema {
        all: export_border_style_cell(borders.all),
        columns: export_hash_map_border_style_cell(borders.columns),
        rows: export_hash_map_border_style_cell(borders.rows),

        left: export_border_side(borders.left),
        right: export_border_side(borders.right),
        top: export_border_side(borders.top),
        bottom: export_border_side(borders.bottom),
    }
}

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

fn import_border_style_cell(schema: current::BorderStyleCellSchema) -> BorderStyleCell {
    BorderStyleCell {
        top: schema.top.map(import_border_style_timestamp),
        bottom: schema.bottom.map(import_border_style_timestamp),
        left: schema.left.map(import_border_style_timestamp),
        right: schema.right.map(import_border_style_timestamp),
    }
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

fn import_column_repeat(
    schema: HashMap<i64, current::ColumnRepeatSchema<current::BorderStyleTimestampSchema>>,
) -> ColumnData<SameValue<BorderStyleTimestamp>> {
    let mut data = ColumnData::new();
    schema.into_iter().for_each(|(start, repeat_schema)| {
        let value = import_border_style_timestamp(repeat_schema.value);
        let len = repeat_schema.len as usize;
        data.insert_block(start, len, value);
    });

    data
}

fn import_border_side(
    schema: HashMap<
        i64,
        HashMap<i64, current::ColumnRepeatSchema<current::BorderStyleTimestampSchema>>,
    >,
) -> HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>> {
    schema
        .into_iter()
        .map(|(col, repeat_schema)| (col, import_column_repeat(repeat_schema)))
        .collect()
}

fn import_hash_map_border_style_cell(
    schema: HashMap<i64, current::BorderStyleCellSchema>,
) -> HashMap<i64, BorderStyleCell> {
    schema
        .into_iter()
        .map(|(i, schema)| (i, import_border_style_cell(schema)))
        .collect()
}

pub fn import_borders(borders: current::BordersSchema) -> Borders {
    Borders {
        all: import_border_style_cell(borders.all),
        columns: import_hash_map_border_style_cell(borders.columns),
        rows: import_hash_map_border_style_cell(borders.rows),

        left: import_border_side(borders.left),
        right: import_border_side(borders.right),
        top: import_border_side(borders.top),
        bottom: import_border_side(borders.bottom),
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        controller::GridController,
        grid::{BorderSelection, BorderStyle},
        selection::Selection,
        SheetRect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn import_export_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 9, 9, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.clone();

        let exported = export_borders(borders);
        let imported = import_borders(exported);
        assert_eq!(sheet.borders, imported);
    }
}
