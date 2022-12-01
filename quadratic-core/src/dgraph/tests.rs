use super::*;
use crate::grid::Pos;

#[test]
fn test_dgraph_controller() {
    let mut grid = DGraphController::new();

    grid.set_dependencies(
        Pos { x: 1, y: 3 },
        &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 3 }),
        vec![Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 },]
    );

    grid.set_dependencies(Pos { x: 1, y: 4 }, &[Pos { x: 1, y: 3 }])
        .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 1, y: 4 }),
        vec![Pos { x: 1, y: 3 }, Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 },]
    );

    grid.set_dependencies(
        Pos { x: 2, y: 3 },
        &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 2, y: 3 }),
        &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 },]
    );

    grid.set_dependencies(
        Pos { x: 3, y: 3 },
        &[Pos { x: 2, y: 3 }, Pos { x: 1, y: 4 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 3, y: 3 }),
        vec![
            Pos { x: 2, y: 3 },
            Pos { x: 1, y: 4 },
            Pos { x: 1, y: 2 },
            Pos { x: 1, y: 1 },
            Pos { x: 1, y: 3 },
        ]
    );

    grid.set_dependencies(
        Pos { x: 10, y: 8 },
        &[Pos { x: 10, y: 9 }, Pos { x: 10, y: 10 }],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 10, y: 8 }),
        vec![Pos { x: 10, y: 9 }, Pos { x: 10, y: 10 },]
    );

    grid.set_dependencies(Pos { x: 10, y: 8 }, &[Pos { x: 3, y: 3 }])
        .unwrap();
    assert_eq!(
        grid.get_dependent_cells(Pos { x: 10, y: 8 }),
        vec![
            Pos { x: 3, y: 3 },
            Pos { x: 2, y: 3 },
            Pos { x: 1, y: 4 },
            Pos { x: 1, y: 2 },
            Pos { x: 1, y: 1 },
            Pos { x: 1, y: 3 },
        ]
    );

    // test non existant nodes
    assert_eq!(grid.get_dependent_cells(Pos { x: 50, y: 50 }), []);

    println!("{}", grid);

    //   // Test remove_dependency_from_graph
    //   dg.remove_dependency_from_graph([10, 8], [[3, 3]]);
    // grid.remove_dependencies_from_graph(&[Pos { x: 10, y: 8 }], &[Pos { x: 3, y: 3 }]);
    // assert_eq!(
    //     grid.get_dependent_cells(Pos { x: 10, y: 8 }),
    //     vec![Pos { x: 10, y: 9 }, Pos { x: 10, y: 10 },]
    // );

    // grid.remove_dependencies_from_graph(
    //     &[Pos { x: 10, y: 8 }],
    //     &[Pos { x: 10, y: 9 }, Pos { x: 10, y: 10 }],
    // );
    // grid.remove_dependencies_from_graph(
    //     &[Pos { x: 3, y: 3 }],
    //     &[Pos { x: 2, y: 3 }, Pos { x: 1, y: 4 }],
    // );
    // grid.remove_dependencies_from_graph(
    //     &[Pos { x: 2, y: 3 }],
    //     &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    // );
    // grid.remove_dependencies_from_graph(&[Pos { x: 1, y: 4 }], &[Pos { x: 1, y: 3 }]);
    // grid.remove_dependencies_from_graph(
    //     &[Pos { x: 1, y: 3 }],
    //     &[Pos { x: 1, y: 2 }, Pos { x: 1, y: 1 }],
    // );

    println!("{}", grid);

    assert_eq!(grid.graph().edge_count(), 8);

    //   // Test CircularReferenceException, should throw error
    //   // dg.add_dependency_to_graph([1, 2], [[3, 3]]);
}
