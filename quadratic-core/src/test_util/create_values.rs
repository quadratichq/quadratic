#[cfg(test)]
use crate::{Pos, SheetPos, controller::GridController, grid::SheetId};

/// Sets a grid of values in a sheet starting at pos with width w and height h filled with values 0, 1, 2, ..., w * h - 1.
#[cfg(test)]
pub fn test_set_values(gc: &mut GridController, sheet_id: SheetId, pos: Pos, w: i64, h: i64) {
    let values: Vec<String> = (0..w * h).map(|i| i.to_string()).collect();
    test_set_values_with_values(
        gc,
        sheet_id,
        pos,
        w,
        h,
        &values.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
    );
}

/// Sets a grid of values in a sheet starting at pos with width w and height h filled with values.
#[cfg(test)]
pub fn test_set_values_with_values(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    w: i64,
    h: i64,
    values: &[&str],
) {
    let mut i = 0;
    for y in pos.y..pos.y + h {
        for x in pos.x..pos.x + w {
            gc.set_cell_value(SheetPos::new(sheet_id, x, y), values[i].to_string(), None);
            i += 1;
        }
    }
}
