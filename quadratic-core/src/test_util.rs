use std::str::FromStr;

use crate::{
    controller::GridController,
    grid::{Bold, SheetId},
    CellValue, Pos, Rect,
};

use bigdecimal::BigDecimal;
use tabled::{
    builder::Builder,
    settings::Color,
    settings::{Modify, Style},
};

fn to_cell_value(value: &str) -> CellValue {
    let parsed = CellValue::strip_percentage(CellValue::strip_currency(value)).trim();
    let number = BigDecimal::from_str(parsed);
    let is_true = parsed.eq_ignore_ascii_case("true");
    let is_false = parsed.eq_ignore_ascii_case("false");
    let is_bool = is_true || is_false;

    match (number, is_bool) {
        (Ok(number), false) => CellValue::Number(number),
        (_, true) => CellValue::Logical(is_true),
        _ => CellValue::Text(String::from(value)),
    }
}

/// Run an assertion that a cell value is equal to the given value
pub fn assert_cell_value(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    value: &str,
) {
    let sheet = grid_controller.grid().sheet_from_id(sheet_id);
    let cell_value = sheet
        .get_cell_value(Pos { x, y })
        .unwrap_or(CellValue::Blank);
    let expected = if value == "" {
        CellValue::Blank
    } else {
        to_cell_value(value)
    };

    assert_eq!(
        cell_value, expected,
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        x, y, expected, cell_value
    );
}

/// Run an assertion that cell values in a given row are equal to the given value
pub fn assert_cell_value_row(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x_start: i64,
    x_end: i64,
    y: i64,
    value: Vec<&str>,
) {
    for (index, x) in (x_start..=x_end).enumerate() {
        if let Some(cell_value) = value.get(index) {
            assert_cell_value(grid_controller, sheet_id, x, y, cell_value);
        } else {
            println!("No value at position ({},{})", index, y);
        }
    }
}

pub fn assert_cell_format_bold_row(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x_start: i64,
    x_end: i64,
    y: i64,
    value: Vec<bool>,
) {
    for (index, x) in (x_start..=x_end).enumerate() {
        assert_cell_format_bold(
            grid_controller,
            sheet_id,
            x,
            y,
            *value.get(index).unwrap_or(&false),
        );
    }
}

pub fn assert_cell_format_bold(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    expect_bold: bool,
) {
    let sheet = grid_controller.grid().sheet_from_id(sheet_id);
    let has_bold = sheet.get_formatting_value::<Bold>(Pos { x, y }).is_some();
    assert!(
        has_bold == expect_bold,
        "Cell at ({}, {}) should be bold={}, but is actually bold={}",
        x,
        y,
        expect_bold,
        has_bold
    );
}
/// Util to print a simple grid to assist in TDD
pub fn print_table(grid_controller: &GridController, sheet_id: SheetId, range: Rect) {
    let sheet = grid_controller.grid().sheet_from_id(sheet_id);
    let mut vals = vec![];
    let mut builder = Builder::default();
    let columns = (range.x_range())
        .map(|i| i.to_string())
        .collect::<Vec<String>>();
    let mut blank = vec!["".to_string()];
    blank.extend(columns.clone());
    builder.set_header(blank);
    let mut bolds = vec![];
    let mut count_x = 0;
    let mut count_y = 0;

    range.y_range().for_each(|y| {
        vals.push(y.to_string());
        range.x_range().for_each(|x| {
            let pos: Pos = Pos { x, y };

            if sheet.get_formatting_value::<Bold>(pos).is_some() {
                bolds.push((count_y + 1, count_x + 1));
            }

            vals.push(
                sheet
                    .get_cell_value(pos)
                    .unwrap_or(CellValue::Blank)
                    .to_string(),
            );
            count_x += 1;
        });
        builder.push_record(vals.clone());
        vals.clear();
        count_x = 0;
        count_y += 1;
    });

    let mut table = builder.build();
    table.with(Style::modern());

    bolds.iter().for_each(|coords| {
        table.with(
            Modify::new((coords.0, coords.1))
                .with(Color::BOLD)
                .with(Color::FG_BRIGHT_RED),
        );
    });
    println!("\nsheet: {}\n{}", sheet.id, table);
}
