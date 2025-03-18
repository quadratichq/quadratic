#[cfg(test)]
use crate::{
    controller::GridController,
    grid::{DataTable, SheetId},
    Pos,
};

/// Creates a data table on the first sheet of the grid controller. The values
/// will be converted to CellValues and fill the table row-wise (ie, the first
/// values will fill the columns of the first row, etc.).
///
/// Returns a clone of the created data table.
#[track_caller]
#[cfg(test)]
pub fn test_create_data_table_first_sheet(
    gc: &mut GridController,
    pos: Pos,
    width: usize,
    height: usize,
    values: &[&str],
) -> DataTable {
    test_create_data_table(gc, gc.sheet_ids()[0], pos, width, height, values);
    gc.sheet(gc.sheet_ids()[0])
        .data_table(pos)
        .expect("Data table not found")
        .clone()
}

/// Creates a data table on the given sheet of the grid controller. The values
/// will be converted to CellValues and fill the table row-wise (ie, the first
/// values will fill the columns of the first row, etc.).
///
/// The table's name is "test", and the first row is not a header.
#[track_caller]
#[cfg(test)]
pub fn test_create_data_table(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    width: usize,
    height: usize,
    values: &[&str],
) {
    let mut v = vec![];
    for y in 0..height {
        let mut row = vec![];
        for x in 0..width {
            row.push(values[y * width + x].to_string());
        }
        v.push(row);
    }
    gc.add_data_table(
        pos.to_sheet_pos(sheet_id),
        "test_table".to_string(),
        v,
        false,
        None,
    );
}
