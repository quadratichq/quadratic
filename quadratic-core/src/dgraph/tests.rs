use super::*;
use crate::grid::Pos;

#[test]
fn test_dgraph_controller() {
    let mut grid = DGraph::new();

    grid.add_dependencies(
        Pos { x: 1, y: 3 },
        &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![Pos { x: 1, y: 3 }]
    );

    grid.add_dependencies(Pos { x: 1, y: 4 }, &[Pos { x: 1, y: 3 }])
        .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![Pos { x: 1, y: 3 }, Pos { x: 1, y: 4 }]
    );

    grid.add_dependencies(
        Pos { x: 2, y: 3 },
        &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![Pos { x: 1, y: 3 }, Pos { x: 2, y: 3 }, Pos { x: 1, y: 4 }]
    );

    grid.add_dependencies(
        Pos { x: 3, y: 3 },
        &[Pos { x: 2, y: 3 }, Pos { x: 1, y: 4 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![
            Pos { x: 1, y: 3 },
            Pos { x: 2, y: 3 },
            Pos { x: 1, y: 4 },
            Pos { x: 3, y: 3 },
        ]
    );

    grid.add_dependencies(
        Pos { x: 10, y: 8 },
        &[Pos { x: 10, y: 9 }, Pos { x: 10, y: 10 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 10, y: 9 }),
        vec![Pos { x: 10, y: 8 }]
    );

    grid.add_dependencies(Pos { x: 10, y: 8 }, &[Pos { x: 3, y: 3 }])
        .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 2 }),
        vec![
            Pos { x: 1, y: 3 },
            Pos { x: 2, y: 3 },
            Pos { x: 1, y: 4 },
            Pos { x: 3, y: 3 },
            Pos { x: 10, y: 8 },
        ]
    );

    // test non existant nodes
    assert_eq!(grid.get_dependent_cells(Pos { x: 50, y: 50 }), []);

    // Test remove_dependency_from_graph
    grid.remove_dependencies(Pos { x: 10, y: 8 }, &[Pos { x: 3, y: 3 }]);
    assert_eq!(grid.get_dependent_cells(Pos { x: 3, y: 3 }), vec![]);

    grid.remove_dependencies(
        Pos { x: 10, y: 8 },
        &[Pos { x: 10, y: 9 }, Pos { x: 10, y: 10 }],
    );
    grid.remove_dependencies(
        Pos { x: 3, y: 3 },
        &[Pos { x: 2, y: 3 }, Pos { x: 1, y: 4 }],
    );
    grid.remove_dependencies(
        Pos { x: 2, y: 3 },
        &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    );
    grid.remove_dependencies(Pos { x: 1, y: 4 }, &[Pos { x: 1, y: 3 }]);
    grid.remove_dependencies(
        Pos { x: 1, y: 3 },
        &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    );

    println!("{}", grid);

    assert_eq!(grid.graph().edge_count(), 0);
    assert_eq!(grid.graph().node_count(), 0);
}

#[test]
fn test_dgraph_controller_cycle() {
    let mut grid = DGraph::new();

    grid.add_dependencies(Pos { x: 0, y: 0 }, &[Pos { x: 1, y: 1 }])
        .unwrap();

    // create circular dependency
    let result = grid.add_dependencies(Pos { x: 1, y: 1 }, &[Pos { x: 0, y: 0 }]);

    assert_eq!(
        result,
        Err(DependencyCycleError {
            source: Pos { x: 1, y: 1 }
        })
    );
}
