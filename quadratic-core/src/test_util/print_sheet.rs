use crate::{
    CellValue, Pos, Rect,
    a1::{A1Context, column_name},
    controller::GridController,
    formulas::convert_rc_to_a1,
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
        print_table_sheet(sheet, rect, true);
    } else {
        println!("\n{}\nSheet is empty", sheet.name);
    }
}

/// Util to print a simple grid to assist in TDD
#[track_caller]
pub fn print_table_from_grid(grid: &GridController, sheet_id: SheetId, rect: Rect) {
    let sheet = grid.grid().try_sheet(sheet_id).unwrap();
    print_table_sheet(sheet, rect, true);
}

/// Util to print a simple grid to assist in TDD
#[track_caller]
pub fn print_table_sheet(sheet: &Sheet, rect: Rect, display_cell_values: bool) {
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
    // `self.a1_context()` is default--DF: may cause issues?
    let parse_ctx = A1Context::default();

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

            let cell_value = match display_cell_values {
                true => sheet.cell_value(pos),
                false => {
                    if let Some((pos, dt)) = sheet.data_table_that_contains(pos) {
                        if dt.is_html_or_image() {
                            Some(CellValue::Text("chart".to_string()))
                        } else {
                            Some(
                                dt.cell_value_at((x - pos.x) as u32, (y - pos.y) as u32)
                                    .unwrap_or(CellValue::Blank),
                            )
                        }
                    } else {
                        Some(sheet.cell_value(pos).unwrap_or(CellValue::Blank))
                    }
                }
            };

            let cell_value = match cell_value {
                Some(CellValue::Code(code_cell)) => {
                    match code_cell.language {
                        CodeCellLanguage::Formula => convert_rc_to_a1(
                            &code_cell.code.to_string(),
                            &parse_ctx,
                            pos.to_sheet_pos(sheet.id),
                        ),
                        CodeCellLanguage::Python => code_cell.code.to_string(),
                        CodeCellLanguage::Connection { .. } => code_cell.code.to_string(),
                        CodeCellLanguage::Javascript => code_cell.code.to_string(),
                        CodeCellLanguage::Import => "import".to_string(),
                    };
                    let value = sheet
                        .display_value(pos)
                        .unwrap_or(CellValue::Blank)
                        .to_string();
                    format!("{:?} ({})", code_cell.language, value)
                }
                Some(CellValue::Import(import)) => import.to_string(),
                _ => {
                    match sheet.display_value(pos) {
                        None | Some(CellValue::Blank) => {
                            if sheet
                                .data_table_that_contains(pos)
                                .is_some_and(|(_, dt)| dt.is_html_or_image())
                            {
                                CellValue::Text("chart".to_string())
                            } else {
                                CellValue::Blank
                            }
                        }
                        Some(display_value) => display_value,
                    }
                }
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

    println!("\n{}\n{}", sheet.name, table);
}
