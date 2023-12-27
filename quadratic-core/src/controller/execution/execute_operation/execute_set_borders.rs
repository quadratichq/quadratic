use crate::controller::{operations::operation::Operation, GridController};

impl GridController {
    pub fn execute_set_borders(&mut self, op: &Operation) {
        match op.clone() {
            Operation::SetBorders {
                sheet_rect,
                borders,
            } => {
                self.sheets_with_dirty_bounds.insert(sheet_rect.sheet_id);
                self.summary
                    .border_sheets_modified
                    .push(sheet_rect.sheet_id);
                self.summary.generate_thumbnail =
                    self.summary.generate_thumbnail || self.thumbnail_dirty_sheet_rect(&sheet_rect);

                let sheet = self.grid.sheet_mut_from_id(sheet_rect.sheet_id);

                let old_borders = sheet.set_region_borders(&sheet_rect.into(), borders.clone());

                // should be removed
                self.forward_operations.push(Operation::SetBorders {
                    sheet_rect,
                    borders,
                });
                self.reverse_operations.insert(
                    0,
                    Operation::SetBorders {
                        sheet_rect,
                        borders: old_borders,
                    },
                );
            }
            _ => unreachable!("Expected Operation::SetBorders"),
        }
    }
}
