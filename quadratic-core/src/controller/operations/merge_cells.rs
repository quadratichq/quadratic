use super::operation::Operation;
use crate::{
    a1::A1Selection, controller::GridController, grid::sheet::merge_cells::MergeCellsUpdate,
};

impl GridController {
    /// Creates merge cells operations from an A1Selection.
    pub fn merge_cells_a1_selection_operations(&self, selection: A1Selection) -> Vec<Operation> {
        let mut ops = vec![];

        let Some(_sheet) = self.try_sheet(selection.sheet_id) else {
            return ops;
        };

        // For each range in the selection, create merge cells operations
        for range in selection.ranges.iter() {
            match range {
                crate::a1::CellRefRange::Sheet { range } => {
                    let rect = range.to_rect_unbounded();

                    // Skip single cell selections (should be handled by UI, but double-check)
                    if rect.min.x == rect.max.x && rect.min.y == rect.max.y {
                        continue;
                    }

                    // Create merge cells update for this rect
                    let mut merge_cells_update = MergeCellsUpdate::default();
                    merge_cells_update.set_rect(
                        rect.min.x,
                        rect.min.y,
                        Some(rect.max.x),
                        Some(rect.max.y),
                        Some(crate::ClearOption::Some(rect.min)),
                    );

                    ops.push(Operation::SetMergeCells {
                        sheet_id: selection.sheet_id,
                        merge_cells_updates: merge_cells_update,
                    });
                }
                crate::a1::CellRefRange::Table { .. } => {
                    // Merge cells are not supported for table ranges
                    // Skip table ranges
                }
            }
        }

        ops
    }
}
