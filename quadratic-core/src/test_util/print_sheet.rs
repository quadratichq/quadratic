use crate::{
    CellValue, Pos, Rect,
    a1::column_name,
    controller::GridController,
    grid::{CodeCellLanguage, GridBounds, Sheet, SheetId},
};

use std::collections::HashMap;

use tabled::{
    builder::Builder,
    settings::{Color, themes::Colorization},
    settings::{Modify, Style},
};

/// Util to print the first sheet
pub fn print_first_sheet(gc: &GridController) {
    let sheet = gc.try_sheet(gc.sheet_ids()[0]).unwrap();
    print_sheet(sheet);
}

/// Util to print the entire sheet
#[track_caller]
pub fn print_sheet(sheet: &Sheet) {
    let bounds = sheet.bounds(true);
    if let GridBounds::NonEmpty(rect) = bounds {
        print_table_sheet(sheet, rect);
    } else {
        println!("\n{}\nSheet is empty", sheet.name);
    }
}

/// Util to print a simple grid to assist in TDD
#[track_caller]
pub fn print_table_from_grid(grid: &GridController, sheet_id: SheetId, rect: Rect) {
    let sheet = grid.grid().try_sheet(sheet_id).unwrap();
    print_table_sheet(sheet, rect);
}

/// Util to print a simple grid to assist in TDD
#[track_caller]
pub fn print_table_sheet(sheet: &Sheet, rect: Rect) {
    let mut vals = vec![];
    let mut builder = Builder::default();
    let columns = (rect.x_range()).map(column_name).collect::<Vec<String>>();
    let mut blank = vec!["".to_string()];
    blank.extend(columns.clone());
    builder.set_header(blank);
    let mut bolds = vec![];
    let mut fill_colors = vec![];
    let mut count_x = 0;
    let mut count_y = 0;

    // todo: may not need this anymore, but keeping here in case we need to revisit once we're compiling
    // `self.a1_context()` is default--DF: may cause issues?
    // let parse_ctx = A1Context::default();

    // convert the selected range in the sheet to tabled
    rect.y_range().for_each(|y| {
        vals.push(y.to_string());
        rect.x_range().for_each(|x| {
            let pos = Pos { x, y };

            if sheet.formats.bold.get(pos).is_some_and(|bold| bold) {
                bolds.push((count_y + 1, count_x + 1));
            }

            if let Some(fill_color) = sheet.formats.fill_color.get(pos) {
                fill_colors.push((count_y + 1, count_x + 1, fill_color));
            }

            match sheet.cell_value(pos) {
                Some(cell_value) => vals.push(cell_value.to_string()),
                None => {
                    if let Some((dt_pos, dt)) = sheet.data_table_that_contains(pos) {
                        if dt.is_html_or_image() {
                            if dt_pos.y == pos.y && dt_pos.x == pos.x {
                                vals.push(format!("{} (Chart)", dt.name.to_string()));
                            } else {
                                vals.push("(..)".to_string());
                            }
                        } else {
                            let language = if x - dt_pos.x == 0 && y - dt_pos.y == 0 {
                                if let Some(code_run) = dt.code_run() {
                                    match code_run.language {
                                        CodeCellLanguage::Formula => " (Formula)".to_string(),
                                        CodeCellLanguage::Python => " (Python)".to_string(),
                                        CodeCellLanguage::Javascript => " (Javascript)".to_string(),
                                        CodeCellLanguage::Connection { kind, .. } => {
                                            kind.to_string()
                                        }
                                        _ => "".to_string(),
                                    }
                                } else {
                                    " (Import)".to_string()
                                }
                            } else {
                                " (..)".to_string()
                            };
                            let cell_value = dt
                                .cell_value_at((x - dt_pos.x) as u32, (y - dt_pos.y) as u32)
                                .unwrap_or(CellValue::Blank);
                            vals.push(format!("{}{}", cell_value, language));
                        };
                    } else {
                        vals.push(String::default());
                    }
                }
            }

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

    println!("\n{}\n{}", sheet.name, table);
}
