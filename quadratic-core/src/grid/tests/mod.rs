use std::collections::HashMap;

use proptest::prelude::*;

use super::*;
use crate::{IsBlank, Rect};

pub mod order;

#[test]
fn test_read_write() {
    let region = Rect {
        min: Pos::ORIGIN,
        max: Pos { x: 49, y: 49 },
    };
    let mut sheet = Sheet::new(
        SheetId::new(),
        "name".to_string(),
        key_between(&None, &None).unwrap(),
    );
    sheet.with_random_floats(&region);
    assert_eq!(GridBounds::NonEmpty(region), sheet.bounds(true));
    assert_eq!(GridBounds::NonEmpty(region), sheet.bounds(false));
}

proptest! {
    #[test]
    fn proptest_sheet_writes(writes: Vec<(Pos, CellValue)>) {
        proptest_sheet_writes_internal(writes);
    }
}

fn proptest_sheet_writes_internal(writes: Vec<(Pos, CellValue)>) {
    let mut sheet = Sheet::new(
        SheetId::new(),
        "TestSheet".to_string(),
        key_between(&None, &None).unwrap(),
    );

    // We'll be testing against the  ~ HASHMAP OF TRUTH ~
    let mut hashmap_of_truth = HashMap::new();

    for (pos, cell_value) in &writes {
        sheet.set_cell_value(*pos, cell_value.clone());
        hashmap_of_truth.insert(*pos, cell_value);
    }

    let nonempty_positions = hashmap_of_truth
        .iter()
        .filter(|(_, value)| !value.is_blank())
        .map(|(pos, _)| pos);
    let min_x = nonempty_positions.clone().map(|pos| pos.x).min();
    let min_y = nonempty_positions.clone().map(|pos| pos.y).min();
    let max_x = nonempty_positions.clone().map(|pos| pos.x).max();
    let max_y = nonempty_positions.clone().map(|pos| pos.y).max();
    let expected_bounds = match (min_x, min_y, max_x, max_y) {
        (Some(min_x), Some(min_y), Some(max_x), Some(max_y)) => GridBounds::NonEmpty(Rect {
            min: Pos { x: min_x, y: min_y },
            max: Pos { x: max_x, y: max_y },
        }),
        _ => GridBounds::Empty,
    };

    for (pos, expected) in hashmap_of_truth {
        let actual = sheet.get_cell_value(pos);
        if expected.is_blank() {
            assert_eq!(None, actual);
        } else {
            assert_eq!(Some(expected.clone()), actual);
        }
    }

    sheet.recalculate_bounds();
    assert_eq!(expected_bounds, sheet.bounds(false));
    assert_eq!(expected_bounds, sheet.bounds(true));
}
