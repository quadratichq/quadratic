use crate::codestore::CodeCell;
use crate::codestore::CodeType;
use crate::formulas::*;
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

#[test]
fn test_gc_simulate_user_actions() {
    let mut grid = GridController::new();

    // User Sets A1 to 10
    grid.transact(|t| {
        t.exec(Command::SetCell(Pos { x: 0, y: 0 }, Cell::Int(10)))?;
        Ok(())
    });

    // User Sets A2 to 20
    grid.transact(|t| {
        t.exec(Command::SetCell(Pos { x: 0, y: 1 }, Cell::Int(20)))?;
        Ok(())
    });

    // User sets B1 to "A1 + A2"
    grid.transact(|t| {
        // eval formula
        let form = Formula::new_sum(&[Pos { x: 0, y: 0 }, Pos { x: 0, y: 1 }]);
        let r_cell = form
            .eval(t.cells(), Pos { x: 1, y: 0 })
            .unwrap()
            .inner
            .to_string();
        let r_expected = 30.to_string();
        assert_eq!(r_expected, r_cell);

        // Command to save formula on B1 of "=A1+A2" in R1C1 form "=RC[-1]+R[1]C[-1]"
        t.exec(Command::SetCellCode(
            Pos { x: 1, y: 0 },
            Some(CodeCell {
                code: form.to_string(),
                code_type: CodeType::Formula,
            }),
        ))?;

        // set result value, and update dep graph
        t.exec(Command::SetCell(Pos { x: 1, y: 0 }, Cell::Text(r_cell)))?;
        t.exec(Command::AddCellDependencies(
            Pos { x: 1, y: 0 },
            vec![Pos { x: 0, y: 0 }, Pos { x: 0, y: 1 }],
        ))?;

        Ok(())
    });

    // Show consistent behavior in graph when undoing and redoing
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 0, y: 0 }),
        vec![Pos { x: 1, y: 0 }]
    );
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 0, y: 1 }),
        vec![Pos { x: 1, y: 0 }]
    );
    assert!(grid.has_undo());
    assert!(!grid.has_redo());
    grid.undo();
    assert_eq!(grid.get_dependent_cells(Pos { x: 0, y: 0 }), vec![]);
    assert_eq!(grid.get_dependent_cells(Pos { x: 0, y: 1 }), vec![]);
    assert!(grid.has_undo());
    assert!(grid.has_redo());
    grid.redo();

    // User sets A1 to 15
    grid.transact(|t| {
        t.exec(Command::SetCell(Pos { x: 0, y: 0 }, Cell::Int(15)))?;
        // TODO: loop through all dependent cells and compute them
        t.exec(Command::SetCell(Pos { x: 1, y: 0 }, Cell::Int(35)))?;

        Ok(())
    });
}
