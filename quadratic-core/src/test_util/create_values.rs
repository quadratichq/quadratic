#[cfg(test)]
use crate::{Pos, SheetPos, controller::GridController, grid::SheetId};

/// Sets a grid of values in a sheet starting at pos with width w and height h filled with values 0, 1, 2, ..., w * h - 1.
#[cfg(test)]
pub(crate) fn test_set_values(gc: &mut GridController, sheet_id: SheetId, pos: Pos, w: i64, h: i64) {
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
pub(crate) fn test_set_values_with_values(
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
            gc.set_cell_value(
                SheetPos::new(sheet_id, x, y),
                values[i].to_string(),
                None,
                false,
            );
            i += 1;
        }
    }
}

/// Sets a rect with the values in the first sheet.
#[cfg(test)]
pub(crate) fn test_set_values_rect(
    gc: &mut GridController,
    x: i64,
    y: i64,
    w: i64,
    h: i64,
    values: Vec<&str>,
) {
    use crate::first_sheet_id;

    let sheet_id = first_sheet_id(gc);
    let mut i = 0;
    for y in y..y + h {
        for x in x..x + w {
            gc.set_cell_value(
                SheetPos::new(sheet_id, x, y),
                values[i].to_string(),
                None,
                false,
            );
            i += 1;
        }
    }
}

#[cfg(test)]
mod test {
    use crate::test_util::*;

    #[test]
    fn test_test_set_values_rect() {
        let mut gc = test_create_gc();
        test_set_values_rect(&mut gc, 1, 1, 2, 2, vec!["1", "2", "3", "4"]);

        print_first_sheet(&gc);
        assert_display_cell_value_first_sheet(&gc, 1, 1, "1");
        assert_display_cell_value_first_sheet(&gc, 2, 1, "2");
        assert_display_cell_value_first_sheet(&gc, 1, 2, "3");
        assert_display_cell_value_first_sheet(&gc, 2, 2, "4");
    }
}
