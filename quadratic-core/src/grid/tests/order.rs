use super::*;

fn setup_grid() -> Grid {
    let mut grid = Grid::new();
    grid.sheets[0].name = String::from('0');
    let grid1 = grid.add_sheet(None).ok().unwrap();
    grid.sheet_mut_from_id(grid1).name = String::from('1');
    let grid2 = grid.add_sheet(None).ok().unwrap();
    grid.sheet_mut_from_id(grid2).name = String::from('2');
    grid
}

#[test]
fn test_order_add_sheet() {
    let grid = setup_grid();
    let sheet_0 = &grid.sheets[0];
    let sheet_1 = &grid.sheets[1];
    let sheet_2 = &grid.sheets[2];
    assert!(sheet_0.order < sheet_1.order);
    assert!(sheet_1.order < sheet_2.order);
}

#[test]
fn test_order_move_sheet() {
    // starting as name = 0, 1, 2
    let mut grid = setup_grid();

    // moved to name = 1, 0, 2
    grid.move_sheet(
        grid.sheets[0].id,
        key_between(
            &Some(grid.sheets[1].order.clone()),
            &Some(grid.sheets[2].order.clone()),
        )
        .unwrap(),
    );
    assert_eq!(grid.sheets[0].name, String::from('1'));
    assert_eq!(grid.sheets[1].name, String::from('0'));
    assert_eq!(grid.sheets[2].name, String::from('2'));

    // moved to name = 1, 2, 0
    grid.move_sheet(
        grid.sheets[1].id,
        key_between(&Some(grid.sheets[2].order.clone()), &None).unwrap(),
    );
    assert_eq!(grid.sheets[0].name, String::from('1'));
    assert_eq!(grid.sheets[1].name, String::from('2'));
    assert_eq!(grid.sheets[2].name, String::from('0'));

    // moved back to name = 0, 1, 2
    grid.move_sheet(
        grid.sheets[2].id,
        key_between(&None, &Some(grid.sheets[0].order.clone())).unwrap(),
    );
    assert_eq!(grid.sheets[0].name, String::from('0'));
    assert_eq!(grid.sheets[1].name, String::from('1'));
    assert_eq!(grid.sheets[2].name, String::from('2'));
}
