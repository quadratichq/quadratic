use proptest::prelude::*;
use std::collections::HashMap;

use crate::grid::*;

proptest! {
    #[test]
    fn test_set_and_get_cells(cells in strategies::cells_to_set()) {
        test_set_cells(&cells);
    }
}

mod strategies {
    use super::*;

    pub fn smallish_pos() -> impl Strategy<Value = Pos> {
        (-16..16_i64, -16..16_i64)
            .prop_map(|(x, y)| Pos { x, y })
            .boxed()
    }

    pub fn cells_to_set() -> impl Strategy<Value = Vec<(Pos, Cell)>> {
        let cell_value = any::<Option<i64>>().prop_map(|i| i.map_or(Cell::Empty, Cell::Int));
        proptest::collection::vec((smallish_pos(), cell_value), 0..20)
    }
}

fn test_set_cells(cells: &[(Pos, Cell)]) {
    // Compare the grid against a hashmap for reference.
    let mut grid = Grid::default();
    let mut hashmap = HashMap::new();
    for (pos, cell) in cells {
        let old_expected = hashmap.insert(*pos, cell);
        let old_actual = grid.set_cell(*pos, cell.clone()).unwrap();
        assert_eq!(old_actual, *old_expected.unwrap_or(&Cell::Empty));
    }
    assert!(dbg!(&grid).is_valid());
    for (pos, cell) in hashmap {
        assert_eq!(cell, grid.get_cell(pos))
    }
}
