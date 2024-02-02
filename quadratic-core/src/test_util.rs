use crate::{
    controller::GridController,
    grid::{Bold, FillColor, Sheet, SheetId},
    CellValue, Pos, Rect,
};
use std::collections::HashMap;
use tabled::{
    builder::Builder,
    settings::{themes::Colorization, Color},
    settings::{Modify, Style},
};

/// Run an assertion that a cell value is equal to the given value
#[cfg(test)]
pub fn assert_cell_value(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    value: &str,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let cell_value = sheet
        .display_value(Pos { x, y })
        .unwrap_or(CellValue::Blank);
    let expected = if value.is_empty() {
        CellValue::Blank
    } else {
        CellValue::to_cell_value(value)
    };

    assert_eq!(
        cell_value, expected,
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        x, y, expected, cell_value
    );
}

/// Run an assertion that cell values in a given row are equal to the given value
#[cfg(test)]
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

#[cfg(test)]
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

#[cfg(test)]
pub fn assert_cell_format_bold(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    expect_bold: bool,
) {
    let sheet = grid_controller.sheet(sheet_id);
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

// TODO(ddimaria): refactor all format assertions into a generic function
#[cfg(test)]
pub fn assert_cell_format_cell_fill_color_row(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x_start: i64,
    x_end: i64,
    y: i64,
    value: Vec<&str>,
) {
    for (index, x) in (x_start..=x_end).enumerate() {
        assert_cell_format_fill_color(
            grid_controller,
            sheet_id,
            x,
            y,
            value.get(index).unwrap().to_owned(),
        );
    }
}

#[cfg(test)]
pub fn assert_cell_format_fill_color(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    expect_fill_color: &str,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let fill_color = sheet.get_formatting_value::<FillColor>(Pos { x, y });
    assert!(
        fill_color == Some(expect_fill_color.to_string()),
        "Cell at ({}, {}) should be fill_color={:?}, but is actually fill_color={:?}",
        x,
        y,
        expect_fill_color,
        fill_color
    );
}

/// Util to print a simple grid to assist in TDD
pub fn print_table(grid_controller: &GridController, sheet_id: SheetId, range: Rect) {
    let Some(sheet) = grid_controller.try_sheet(sheet_id) else {
        println!("Sheet not found");
        return;
    };
    let mut vals = vec![];
    let mut builder = Builder::default();
    let columns = (range.x_range())
        .map(|i| i.to_string())
        .collect::<Vec<String>>();
    let mut blank = vec!["".to_string()];
    blank.extend(columns.clone());
    builder.set_header(blank);
    let mut bolds = vec![];
    let mut fill_colors = vec![];
    let mut count_x = 0;
    let mut count_y = 0;

    // convert the selected range in the sheet to tabled
    range.y_range().for_each(|y| {
        vals.push(y.to_string());
        range.x_range().for_each(|x| {
            let pos: Pos = Pos { x, y };

            if sheet.get_formatting_value::<Bold>(pos).is_some() {
                bolds.push((count_y + 1, count_x + 1));
            }

            if let Some(fill_color) = sheet.get_formatting_value::<FillColor>(pos) {
                fill_colors.push((count_y + 1, count_x + 1, fill_color));
            }

            vals.push(
                sheet
                    .display_value(pos)
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

    // apply bold values to the table
    bolds.iter().for_each(|coords| {
        table.with(
            Modify::new((coords.0, coords.1))
                .with(Color::BOLD)
                .with(Color::FG_BRIGHT_RED),
        );
    });

    // limited suppported color set
    let bg_colors = HashMap::<&str, Color>::from_iter([
        ("white", Color::BG_WHITE),
        ("red", Color::BG_RED),
        ("blue", Color::BG_BLUE),
        ("green", Color::BG_GREEN),
        ("yellow", Color::BG_BRIGHT_YELLOW),
    ]);

    // apply fill color values to the table
    fill_colors.iter().for_each(|(x, y, fill_color)| {
        let color = bg_colors
            .get(fill_color.as_str())
            .unwrap_or(&Color::BG_WHITE)
            .to_owned();
        table.with(Colorization::exact([color], (*x, *y)));
    });

    println!("\nsheet: {}\n{}", sheet.id, table);
}

/// Prints the order of the code_runs to the console.
pub fn print_code_run_order(sheet: &Sheet) {
    dbgjs!(sheet
        .code_runs
        .iter()
        .map(|(pos, _)| pos)
        .collect::<Vec<_>>());
}
