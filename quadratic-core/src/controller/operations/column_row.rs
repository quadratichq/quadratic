use crate::{controller::GridController, grid::SheetId};

use super::operation::Operation;

impl GridController {
    pub fn delete_column_operations(
        &mut self,
        sheet_id: SheetId,
        column: i64,
    ) -> (Vec<Operation>, Vec<Operation>) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let forward = vec![Operation::DeleteColumn { sheet_id, column }];
            let mut reverse = vec![
                Operation::InsertColumn { sheet_id, column },
                Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size: sheet.offsets.column_width(column),
                    client_resized: false,
                },
            ];
            if let Some(bounds) = sheet.column_bounds(column, false) {
                let mut clear = self.delete_values_and_formatting_operations(
                    (column, bounds.0, column, bounds.1, sheet_id).into(),
                );
                reverse.append(&mut clear);
            }
            (forward, reverse)
        } else {
            (vec![], vec![])
        }
    }
}
