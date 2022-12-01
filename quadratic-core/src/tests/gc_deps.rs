use crate::grid::*;

#[test]
fn test_gc_set_cell_deps() {
    let mut grid = GridController::new();

    // Manually create a transaction.
    grid.transact(|t| {
        t.exec(Command::AddCellDependencies(
            Pos { x: 1, y: 3 },
            vec![Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
        ))?;

        Ok(())
    });

    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![Pos { x: 1, y: 3 }]
    );
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 1 }),
        vec![Pos { x: 1, y: 3 }]
    );

    grid.undo();

    assert_eq!(grid.get_dependent_cells(Pos { x: 1, y: 2 }), vec![]);
    assert_eq!(grid.get_dependent_cells(Pos { x: 1, y: 1 }), vec![]);

    // Manually create a transaction.
    grid.transact(|t| {
        t.exec(Command::AddCellDependencies(
            Pos { x: 1, y: 3 },
            vec![Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
        ))?;
        t.exec(Command::AddCellDependencies(
            Pos { x: 1, y: 4 },
            vec![Pos { x: 1, y: 3 }],
        ))?;
        t.exec(Command::AddCellDependencies(
            Pos { x: 2, y: 3 },
            vec![Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
        ))?;
        t.exec(Command::AddCellDependencies(
            Pos { x: 3, y: 3 },
            vec![Pos { x: 2, y: 3 }, Pos { x: 1, y: 4 }],
        ))?;

        Ok(())
    });

    assert_eq!(grid.get_dependent_cells(Pos { x: 3, y: 3 }), vec![]);
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![
            Pos { x: 1, y: 3 },
            Pos { x: 2, y: 3 },
            Pos { x: 1, y: 4 },
            Pos { x: 3, y: 3 }
        ]
    );
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 3 }),
        vec![Pos { x: 1, y: 4 }, Pos { x: 3, y: 3 }]
    );

    assert!(grid.has_undo());
    assert!(!grid.has_redo());

    grid.undo();

    assert_eq!(grid.get_dependent_cells(Pos { x: 1, y: 2 }), vec![]);

    assert!(!grid.has_undo());
    assert!(grid.has_redo());

    grid.redo();

    assert_eq!(grid.get_dependent_cells(Pos { x: 3, y: 3 }), vec![]);
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![
            Pos { x: 1, y: 3 },
            Pos { x: 2, y: 3 },
            Pos { x: 1, y: 4 },
            Pos { x: 3, y: 3 }
        ]
    );
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 3 }),
        vec![Pos { x: 1, y: 4 }, Pos { x: 3, y: 3 }]
    );
}
