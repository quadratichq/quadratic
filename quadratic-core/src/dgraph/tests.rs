use super::*;
use std::collections::HashSet;

use crate::Pos;
use crate::Rect;

#[test]
fn test_graph() {
    let mut cdc = ComputationDependencyController::new();

    cdc.set_dependencies(
        Pos { x: 3, y: 3 },
        Some(vec![Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 1, y: 1 },
        }]),
    );

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        std::iter::once(Pos { x: 3, y: 3 }).collect()
    );

    cdc.set_dependencies(
        Pos { x: 4, y: 4 },
        Some(vec![Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 1, y: 1 },
        }]),
    );

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        [Pos { x: 3, y: 3 }, Pos { x: 4, y: 4 }]
            .iter()
            .cloned()
            .collect()
    );

    cdc.set_dependencies(Pos { x: 3, y: 3 }, None);

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        std::iter::once(Pos { x: 4, y: 4 }).collect()
    );

    cdc.set_dependencies(Pos { x: 4, y: 4 }, None);

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        HashSet::new()
    );

    cdc.set_dependencies(
        Pos { x: 11, y: 11 },
        Some(vec![Rect::single_pos(Pos { x: 10, y: 10 })]),
    );

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 10, y: 10 })),
        std::iter::once(Pos { x: 11, y: 11 }).collect()
    );
}
