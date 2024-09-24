use crate::{
    controller::GridController,
    formulas::replace_internal_cell_references,
    grid::{Bold, CodeCellLanguage, FillColor, GridBounds, Sheet, SheetId},
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
pub fn assert_display_cell_value(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    value: &str,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let cell_value = sheet
        .display_value(Pos { x, y })
        .map_or_else(|| CellValue::Blank, |v| CellValue::Text(v.to_string()));
    let expected_text_or_blank =
        |v: &CellValue| v == &CellValue::Text(value.into()) || v == &CellValue::Blank;

    assert!(
        expected_text_or_blank(&cell_value),
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        x,
        y,
        CellValue::Text(value.into()),
        cell_value
    );
}

/// Run an assertion that a cell value is equal to the given value
#[cfg(test)]
pub fn assert_code_cell_value(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    value: &str,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let cell_value = sheet.edit_code_value(Pos { x, y }).unwrap();

    assert_eq!(
        value, cell_value.code_string,
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        x, y, value, cell_value.code_string
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
            assert_display_cell_value(grid_controller, sheet_id, x, y, cell_value);
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

// Util to print a simple grid to assist in TDD
pub fn print_table(grid_controller: &GridController, sheet_id: SheetId, rect: Rect) {
    let Some(sheet) = grid_controller.try_sheet(sheet_id) else {
        println!("Sheet not found");
        return;
    };
    print_table_sheet(sheet, rect);
}

/// Util to print the entire sheet
pub fn print_sheet(sheet: &Sheet) {
    let bounds = sheet.bounds(true);
    if let GridBounds::NonEmpty(rect) = bounds {
        print_table_sheet(sheet, rect);
    } else {
        println!("Sheet is empty");
    }
}

/// Util to print a simple grid to assist in TDD
pub fn print_table_sheet(sheet: &Sheet, rect: Rect) {
    let mut vals = vec![];
    let mut builder = Builder::default();
    let columns = (rect.x_range())
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
    rect.y_range().for_each(|y| {
        vals.push(y.to_string());
        rect.x_range().for_each(|x| {
            let pos: Pos = Pos { x, y };

            if sheet.get_formatting_value::<Bold>(pos).is_some() {
                bolds.push((count_y + 1, count_x + 1));
            }

            if let Some(fill_color) = sheet.get_formatting_value::<FillColor>(pos) {
                fill_colors.push((count_y + 1, count_x + 1, fill_color));
            }

            let cell_value = match sheet.cell_value(pos) {
                Some(CellValue::Code(code_cell)) => match code_cell.language {
                    CodeCellLanguage::Formula => {
                        replace_internal_cell_references(&code_cell.code.to_string(), pos)
                    }
                    CodeCellLanguage::Python => code_cell.code.to_string(),
                    CodeCellLanguage::Connection { .. } => code_cell.code.to_string(),
                    CodeCellLanguage::Javascript => code_cell.code.to_string(),
                },
                _ => sheet
                    .display_value(pos)
                    .unwrap_or(CellValue::Blank)
                    .to_string(),
            };

            vals.push(cell_value);
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

    // limited supported color set
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

/// Prints the order of the data_tables to the console.
pub fn print_data_table_order(sheet: &Sheet) {
    dbgjs!(sheet
        .data_tables
        .iter()
        .map(|(pos, _)| pos)
        .collect::<Vec<_>>());
}

// prints formatting for table
pub fn print_table_sheet_formats(sheet: &Sheet, rect: Rect) {
    let mut builder = Builder::default();
    let columns = (rect.x_range())
        .map(|i| i.to_string())
        .collect::<Vec<String>>();
    let mut blank = vec!["".to_string()];
    blank.extend(columns.clone());
    builder.set_header(blank);

    for y in rect.y_range() {
        let mut vals = vec![y.to_string()];
        for x in rect.x_range() {
            let format = sheet.format_cell(x, y, false);
            vals.push(format.to_string());
        }
        builder.push_record(vals);
    }
    let mut table = builder.build();
    table.with(Style::modern());

    println!("\nsheet: {}\n{}", sheet.id, table);
}

#[cfg(test)]
mod test {
    use crate::grid::formats::format_update::FormatUpdate;

    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn print_table_sheet_format() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_format_cell(
            Pos { x: 0, y: 0 },
            &FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            false,
        );
        sheet.set_format_cell(
            Pos { x: 1, y: 1 },
            &FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            false,
        );
        sheet.set_format_cell(
            Pos { x: 2, y: 2 },
            &FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            false,
        );
        sheet.set_format_cell(
            Pos { x: 0, y: 1 },
            &FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
            false,
        );
        sheet.set_format_cell(
            Pos { x: 1, y: 2 },
            &FormatUpdate {
                fill_color: Some(Some("blue".to_string())),
                ..Default::default()
            },
            false,
        );
        sheet.set_format_cell(
            Pos { x: 2, y: 0 },
            &FormatUpdate {
                fill_color: Some(Some("green".to_string())),
                ..Default::default()
            },
            false,
        );
        let rect = Rect::new(0, 0, 3, 3);
        print_table_sheet_formats(sheet, rect);
    }
}
