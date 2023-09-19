use crate::grid::Grid;
use crate::{Pos, Rect};

use super::operations::Operation;

impl Grid {
    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub fn compute(&mut self, updated_cells: Vec<Rect>) -> Vec<Operation> {
        let mut ops = vec![];
        let mut cells_to_compute = updated_cells.clone(); // start with all updated cells

        while let Some(cell) = cells_to_compute.pop() {
            print!("Computing cell - {} \n", cell);
            // find which cells have formulas. Run the formulas and update the cells.
            // add the updated cells to the cells_to_compute

            // add all dependent cells to the cells_to_compute
            let dependent_cells = self.get_dependent_cells(cell);

            // loop through all dependent cells
            for dependent_cell in dependent_cells {
                // add to cells_to_compute
                cells_to_compute.push(Rect::single_pos(dependent_cell));
            }
        }

        return ops;
    }
}

#[test]
fn test_graph() {
    let mut cdc = Grid::new();

    cdc.set_dependencies(
        Pos { x: 0, y: 1 },
        Some(vec![Rect::single_pos(Pos { x: 0, y: 0 })]),
    );
    cdc.set_dependencies(
        Pos { x: 1, y: 1 },
        Some(vec![Rect::single_pos(Pos { x: 0, y: 0 })]),
    );
    cdc.set_dependencies(
        Pos { x: 0, y: 2 },
        Some(vec![
            Rect::single_pos(Pos { x: 0, y: 1 }),
            Rect::single_pos(Pos { x: 1, y: 1 }),
        ]),
    );
    cdc.set_dependencies(
        Pos { x: 1, y: 2 },
        Some(vec![
            Rect::single_pos(Pos { x: 0, y: 0 }),
            Rect::single_pos(Pos { x: 1, y: 1 }),
        ]),
    );

    cdc.compute(vec![Rect::single_pos(Pos { x: 0, y: 0 })]);
}
