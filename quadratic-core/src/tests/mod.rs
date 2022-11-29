use anyhow::Result;
use proptest::prelude::*;
use std::collections::HashMap;

use crate::grid::*;

proptest! {
    #[test]
    fn proptest_set_and_get_cells(cells in strategies::cells_to_set()) {
        test_set_and_get_cells(&cells);
    }

    #[test]
    fn proptest_undo_redo(cell_batches in prop::array::uniform4(strategies::cells_to_set())) {
        test_undo_redo(cell_batches);
    }
}

#[test]
fn test_split_block() {
    test_set_and_get_cells(&[
        (Pos { x: 1, y: 1 }, Cell::Int(10)),
        (Pos { x: 1, y: 2 }, Cell::Int(20)),
        (Pos { x: 1, y: 3 }, Cell::Int(30)),
        (Pos { x: 1, y: 4 }, Cell::Int(40)),
        (Pos { x: 1, y: 5 }, Cell::Int(50)),
        (Pos { x: 1, y: 3 }, Cell::Empty),
    ])
}

#[test]
fn test_dirty_quadrants() {
    assert!(
        crate::QUADRANT_SIZE >= 4,
        "this test expects larger quadrants"
    );

    let mut grid = GridController::new();

    // This command shouldn't matter.
    grid.transact(set_cells_transaction([
        (Pos { x: -1, y: 1 }, Cell::Int(-10)),
        (Pos { x: -1, y: -6 }, Cell::Int(-20)),
    ]));

    // This is the command whose dirty set we'll be testing.
    let dirty = grid.transact(set_cells_transaction([
        (Pos { x: -1, y: 1 }, Cell::Int(10)),
        (Pos { x: 1, y: 1 }, Cell::Int(10)),
        (Pos { x: 1, y: 2 }, Cell::Int(20)),
        (Pos { x: 1, y: 3 }, Cell::Int(30)),
    ]));
    let expected_dirty = DirtyQuadrants([(0, 0), (-1, 0)].into_iter().collect());

    assert_eq!(dirty, expected_dirty);

    // Undo should have the same dirty set.
    assert_eq!(grid.undo(), Some(dirty.clone()));

    // Same with redo.
    assert_eq!(grid.redo(), Some(dirty));
}

mod strategies {
    use super::*;

    pub fn smallish_pos() -> impl Strategy<Value = Pos> {
        (-16..16_i64, -16..16_i64).prop_map(|(x, y)| Pos { x, y })
    }

    pub fn cells_to_set() -> impl Strategy<Value = Vec<(Pos, Cell)>> {
        let cell_value = any::<Option<i64>>().prop_map(|i| i.map_or(Cell::Empty, Cell::Int));
        prop::collection::vec((smallish_pos(), cell_value), 0..20)
    }
}

fn test_set_and_get_cells(cells: &[(Pos, Cell)]) {
    // Compare the grid against a hashmap for reference.
    let mut grid = Grid::default();
    let mut hashmap = HashMap::new();
    for (pos, cell) in cells {
        let old_expected = hashmap.insert(*pos, cell);
        let old_actual = grid.set_cell(*pos, cell.clone());
        assert_eq!(old_actual, *old_expected.unwrap_or(&Cell::Empty));
    }
    assert!(dbg!(&grid).is_valid());
    for (&pos, cell) in &hashmap {
        assert_eq!(*cell, grid.get_cell(pos));
    }

    // Check bounds.
    hashmap.retain(|_pos, cell| !cell.is_empty());
    // IIFE to mimic try_block
    let expected_rect: Option<Rect> = (|| {
        let min_x = hashmap.keys().map(|pos| pos.x).min()?;
        let max_x = hashmap.keys().map(|pos| pos.x).max()?;
        let min_y = hashmap.keys().map(|pos| pos.y).min()?;
        let max_y = hashmap.keys().map(|pos| pos.y).max()?;
        Some(Rect::from_span(
            Pos { x: min_x, y: min_y },
            Pos { x: max_x, y: max_y },
        ))
    })();
    assert_eq!(expected_rect, grid.bounds());
}

fn test_undo_redo(cell_batches: [Vec<(Pos, Cell)>; 4]) {
    let [a, b, c, d] = cell_batches.map(set_cells_transaction);

    // For reference
    let mut grid = GridController::new();
    let initial = grid.clone();
    grid.transact(a);
    let grid_a = grid.clone(); // a
    grid.transact(b);
    let grid_b = grid.clone(); // a -> b
    grid.transact(c);
    let grid_c = grid.clone(); // a -> b -> c

    assert!(
        grid.redo().is_none(),
        "redo should fail because there is nothing to redo",
    );
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_c);

    assert!(grid.undo().is_some(), "undo should succeed");
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_b);

    assert!(grid.undo().is_some(), "undo should succeed");
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_a);

    assert!(grid.undo().is_some(), "undo should succeed");
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, initial);

    assert!(
        grid.undo().is_none(),
        "undo should fail because the stack has been exhausted",
    );
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, initial);

    assert!(grid.redo().is_some(), "redo should succeed",);
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_a);

    let mut grid_d = grid_a.clone();
    grid_d.transact(d.clone()); // a -> d

    grid.transact(d);
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_d);
    assert!(
        grid.redo().is_none(),
        "redo should fail because new command clears the redo stack",
    );
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_d);
    dbg!(&grid_a);

    dbg!(&grid);
    assert!(grid.undo().is_some(), "undo should succeed");
    dbg!(&grid);
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_a);

    assert!(grid.undo().is_some(), "undo should succeed");
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, initial);

    assert!(grid.redo().is_some(), "redo should succeed");
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_a);

    assert!(grid.redo().is_some(), "redo should succeed");
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_d);

    assert!(
        grid.redo().is_none(),
        "redo should fail because the stack has been exhausted",
    );
    assert!(grid.is_valid(), "{:?}", grid);
    assert_eq!(grid, grid_d);
}

fn set_cells_transaction(
    cells: impl Clone + IntoIterator<Item = (Pos, Cell)>,
) -> impl Clone + FnOnce(&mut TransactionInProgress<'_>) -> Result<()> {
    move |t| {
        for (pos, cell) in cells {
            t.exec(Command::SetCell(pos, cell))?;
        }
        Ok(())
    }
}
