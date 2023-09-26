use super::{operations::Operation, GridController};
use crate::SheetRect;

impl GridController {
    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub fn compute(&mut self, updated_cells: Vec<SheetRect>) -> Vec<Operation> {
        let reverse_operations = vec![];
        let mut cells_to_compute = updated_cells.clone(); // start with all updated cells

        while let Some(cell) = cells_to_compute.pop() {
            // print!("Computing cell - {} \n", cell);
            // find which cells have formulas. Run the formulas and update the cells.
            // add the updated cells to the cells_to_compute
            // TODO implement this

            // add all dependent cells to the cells_to_compute
            let dependent_cells = self.grid.get_dependent_cells(cell);

            // loop through all dependent cells
            for dependent_cell in dependent_cells {
                // add to cells_to_compute
                cells_to_compute.push(SheetRect::single_pos(dependent_cell));
            }
        }

        reverse_operations
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, SheetPos, SheetRect};

    #[test]
    fn test_graph() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 0,
                y: 1,
            },
            Some(vec![SheetRect::single_pos(SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            })]),
        );
        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 1,
                y: 1,
            },
            Some(vec![SheetRect::single_pos(SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            })]),
        );
        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 0,
                y: 2,
            },
            Some(vec![
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 0,
                    y: 1,
                }),
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 1,
                    y: 1,
                }),
            ]),
        );
        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 1,
                y: 2,
            },
            Some(vec![
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 0,
                    y: 0,
                }),
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 1,
                    y: 1,
                }),
            ]),
        );

        gc.compute(vec![SheetRect::single_pos(SheetPos {
            sheet_id,
            x: 0,
            y: 0,
        })]);
    }
}
