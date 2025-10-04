#[cfg(test)]
use crate::grid::data_table::DataTable;
#[cfg(test)]
use crate::{
    Pos, Rect,
    controller::GridController,
    grid::{Sheet, SheetId},
};

#[cfg(test)]
use tabled::{
    builder::Builder,
    settings::Color,
    settings::{Modify, Style},
};

/// Util to print a data table when testing
#[track_caller]
#[cfg(test)]
pub(crate) fn pretty_print_data_table(
    data_table: &DataTable,
    title: Option<&str>,
    max: Option<usize>,
) {
    let data_table = output_pretty_print_data_table(data_table, title, max);
    println!("{data_table}");
}

/// Returns a String for a pretty print of a data table for testing
#[track_caller]
#[cfg(test)]
pub(crate) fn output_pretty_print_data_table(
    data_table: &DataTable,
    title: Option<&str>,
    max: Option<usize>,
) -> String {
    if data_table.is_single_value() {
        let value = data_table.cell_value_at(0, 0).unwrap();
        return format!(
            "{title} with single value: {value}",
            title = title.unwrap_or("Data Table"),
            value = value
        );
    }

    let mut builder = Builder::default();
    let array = data_table
        .display_value(false)
        .unwrap()
        .into_array()
        .unwrap();
    let max = max.unwrap_or(array.height() as usize);
    let title = title.unwrap_or("Data Table");
    let display_buffer = data_table
        .display_buffer
        .clone()
        .unwrap_or((0..array.height() as u64).collect::<Vec<_>>());

    for (index, row) in array.rows().take(max).enumerate() {
        let row = row.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let display_index = vec![display_buffer[index].to_string()];

        let show_columns = data_table.get_show_columns();

        if index == 0 && data_table.column_headers.is_some() && show_columns {
            let headers = data_table
                .column_headers
                .as_ref()
                .unwrap()
                .iter()
                .filter(|h| h.display)
                .map(|h| h.name.to_string())
                .collect::<Vec<_>>();
            builder.set_header([display_index, headers].concat());
        } else if index == 0 && data_table.header_is_first_row && show_columns {
            let row = [display_index, row].concat();
            builder.set_header(row);
        } else {
            let row = [display_index, row].concat();
            builder.push_record(row);
        }
    }

    let mut table = builder.build();
    table.with(Style::modern());

    // bold the headers if they exist
    if data_table.header_is_first_row {
        table.with(Modify::new((0, 0)).with(Color::BOLD));

        (0..table.count_columns())
            .collect::<Vec<usize>>()
            .iter()
            .enumerate()
            .for_each(|(index, _)| {
                table.with(Modify::new((0, index + 1)).with(Color::BOLD));
            });
    }

    format!("\nData Table: {title}\n{table}")
}

/// Prints the positions of all data tables in a sheet
#[cfg(test)]
#[allow(unused)]
pub(crate) fn print_table_positions(gc: &GridController, sheet_id: SheetId) {
    let sheet = gc.try_sheet(sheet_id).expect("Sheet not found");
    sheet.data_tables.expensive_iter().for_each(|(pos, _)| {
        println!("Data table at {pos:?}");
    });
}

// Util to print a data table given its anchor position
#[track_caller]
#[cfg(test)]
pub(crate) fn print_table_at(gc: &GridController, sheet_id: SheetId, pos: Pos) {
    let sheet = gc.try_sheet(sheet_id).expect("Sheet not found");
    let data_table = sheet.data_table_at(&pos).expect("Data table not found");
    pretty_print_data_table(data_table, None, None);
}

// Util to print a simple grid to assist in TDD
#[track_caller]
#[cfg(test)]
pub(crate) fn print_table_in_rect(grid_controller: &GridController, sheet_id: SheetId, rect: Rect) {
    let sheet = grid_controller
        .try_sheet(sheet_id)
        .expect("Sheet not found");

    if let Some(data_table) = sheet.data_table_at(&rect.min) {
        let max = rect.max.y - rect.min.y + 1;
        pretty_print_data_table(data_table, None, Some(max as usize));
    } else {
        println!("Data table not found at {:?}", rect.min);
    }
}

/// Prints the order of the data_tables to the console.
#[cfg(test)]
#[allow(unused)]
pub(crate) fn print_data_table_order(sheet: &Sheet) {
    dbgjs!(
        sheet
            .data_tables
            .expensive_iter()
            .map(|(pos, _)| pos)
            .collect::<Vec<_>>()
    );
}

// prints formatting for table
#[cfg(test)]
pub(crate) fn print_table_sheet_formats(sheet: &Sheet, rect: Rect) {
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
            let format = sheet.formats.format(Pos { x, y });
            vals.push(format.to_string());
        }
        builder.push_record(vals);
    }
    let mut table = builder.build();
    table.with(Style::modern());

    println!("\nsheet: {}\n{}", sheet.id, table);
}

#[cfg(test)]
pub(crate) fn print_data_table_locations(gc: &GridController, sheet_id: SheetId) {
    let sheet = gc.sheet(sheet_id);
    sheet.data_tables.expensive_iter().for_each(|(pos, dt)| {
        let size = dt.output_rect(*pos, false);
        println!("Data table at {:?} {}x{}", pos, size.width(), size.height());
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::test_create_data_table_with_values;

    #[test]
    fn print_table_sheet_format() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.formats.bold.set(pos![A1], Some(true));
        sheet.formats.bold.set(pos![B2], Some(true));
        sheet.formats.italic.set(pos![A2], Some(true));
        sheet
            .formats
            .fill_color
            .set(pos![B3], Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(pos![C3], Some("green".to_string()));
        print_table_sheet_formats(sheet, Rect::test_a1("A1:C3"));
    }

    #[test]
    fn test_print_data_table_locations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create two data tables using the test utility
        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![A1],
            2,
            2,
            &["A", "B", "C", "D"],
        );
        test_create_data_table_with_values(&mut gc, sheet_id, pos![C3], 1, 3, &["X", "Y", "Z"]);

        // Test the print function (this will print to console during test)
        print_data_table_locations(&gc, sheet_id);
        // Since this is primarily a print utility, we just verify it runs without panicking
    }
}
