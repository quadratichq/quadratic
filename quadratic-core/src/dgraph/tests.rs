use super::*;

use crate::Pos;

#[test]
fn test_dgraph_controller() {
    let mut grid = DGraphController::new();

    grid.add_dependencies(
        DGraphNode::Position(Pos { x: 1, y: 3 }),
        &[
            DGraphNode::Position(Pos { x: 1, y: 2 }),
            DGraphNode::Position(Pos { x: 1, y: 1 }),
        ],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 1, y: 2 })),
        vec![DGraphNode::Position(Pos { x: 1, y: 3 })]
    );

    grid.add_dependencies(
        DGraphNode::Position(Pos { x: 1, y: 4 }),
        &[DGraphNode::Position(Pos { x: 1, y: 3 })],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 1, y: 2 })),
        vec![
            DGraphNode::Position(Pos { x: 1, y: 3 }),
            DGraphNode::Position(Pos { x: 1, y: 4 })
        ]
    );

    grid.add_dependencies(
        DGraphNode::Position(Pos { x: 2, y: 3 }),
        &[
            DGraphNode::Position(Pos { x: 1, y: 2 }),
            DGraphNode::Position(Pos { x: 1, y: 1 }),
        ],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 1, y: 2 })),
        vec![
            DGraphNode::Position(Pos { x: 1, y: 3 }),
            DGraphNode::Position(Pos { x: 2, y: 3 }),
            DGraphNode::Position(Pos { x: 1, y: 4 })
        ]
    );

    grid.add_dependencies(
        DGraphNode::Position(Pos { x: 3, y: 3 }),
        &[
            DGraphNode::Position(Pos { x: 2, y: 3 }),
            DGraphNode::Position(Pos { x: 1, y: 4 }),
        ],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 1, y: 2 })),
        vec![
            DGraphNode::Position(Pos { x: 1, y: 3 }),
            DGraphNode::Position(Pos { x: 2, y: 3 }),
            DGraphNode::Position(Pos { x: 1, y: 4 }),
            DGraphNode::Position(Pos { x: 3, y: 3 }),
        ]
    );

    grid.add_dependencies(
        DGraphNode::Position(Pos { x: 10, y: 8 }),
        &[
            DGraphNode::Position(Pos { x: 10, y: 9 }),
            DGraphNode::Position(Pos { x: 10, y: 10 }),
        ],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 10, y: 9 })),
        vec![DGraphNode::Position(Pos { x: 10, y: 8 })]
    );

    grid.add_dependencies(
        DGraphNode::Position(Pos { x: 10, y: 8 }),
        &[DGraphNode::Position(Pos { x: 3, y: 3 })],
    )
    .unwrap();
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 1, y: 2 })),
        vec![
            DGraphNode::Position(Pos { x: 1, y: 3 }),
            DGraphNode::Position(Pos { x: 2, y: 3 }),
            DGraphNode::Position(Pos { x: 1, y: 4 }),
            DGraphNode::Position(Pos { x: 3, y: 3 }),
            DGraphNode::Position(Pos { x: 10, y: 8 }),
        ]
    );

    println!("{}", grid);

    // test non-existent nodes
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 50, y: 50 })),
        []
    );

    // Test remove_dependency_from_graph
    grid.remove_dependencies(
        DGraphNode::Position(Pos { x: 10, y: 8 }),
        &[DGraphNode::Position(Pos { x: 3, y: 3 })],
    );
    assert_eq!(
        grid.get_dependent_cells(DGraphNode::Position(Pos { x: 3, y: 3 })),
        vec![]
    );

    //... Remaining tests ...
}

#[test]
fn test_dgraph_controller_cycle() {
    let mut grid = DGraphController::new();

    grid.add_dependencies(
        DGraphNode::Position(Pos { x: 0, y: 0 }),
        &[DGraphNode::Position(Pos { x: 1, y: 1 })],
    )
    .unwrap();

    // create circular dependency
    let result = grid.add_dependencies(
        DGraphNode::Position(Pos { x: 1, y: 1 }),
        &[DGraphNode::Position(Pos { x: 0, y: 0 })],
    );

    assert_eq!(
        result,
        Err(DependencyCycleError {
            source: DGraphNode::Position(Pos { x: 1, y: 1 })
        })
    );
}
