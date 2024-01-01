use uuid::Uuid;

use crate::{
    controller::{
        execution::TransactionType,
        transaction_types::{CellsForArray, JsComputeGetCells},
        GridController,
    },
    error_core::{CoreError, Result},
};
impl GridController {
    /// This is used to get cells during a  async calculation.
    pub fn calculation_get_cells(&mut self, get_cells: JsComputeGetCells) -> Result<CellsForArray> {
        let transaction_id = Uuid::parse_str(&get_cells.transaction_id())?;
        let mut transaction = self.transactions.remove_awaiting_async(transaction_id)?;

        let (current_sheet, pos) = if let Some(current_sheet_pos) = transaction.current_sheet_pos {
            (current_sheet_pos.sheet_id, current_sheet_pos.into())
        } else {
            self.transactions.add_async_transaction(transaction);
            return Err(CoreError::TransactionNotFound(
                "get_cells failed to get current_sheet_pos".to_string(),
            ));
        };

        let sheet_name = get_cells.sheet_name();

        // if sheet_name is None, use the sheet_id from the pos
        let sheet = sheet_name.clone().map_or_else(
            || Some(self.grid().sheet_from_id(current_sheet)),
            |sheet_name| self.grid().sheet_from_name(sheet_name),
        );

        let transaction_type = transaction.transaction_type.clone();
        assert_eq!(transaction_type, TransactionType::User);
        if let Some(sheet) = sheet {
            // ensure that the current cell ref is not in the get_cells request
            if get_cells.rect().contains(pos) && sheet.id == current_sheet {
                // unable to find sheet by name, generate error
                let msg = if let Some(line_number) = get_cells.line_number() {
                    format!("cell cannot reference itself at line {}", line_number)
                } else {
                    "Sheet not found".to_string()
                };
                self.code_cell_sheet_error(&mut transaction, msg, get_cells.line_number())?;
                self.handle_transactions(&mut transaction);
                return Ok(CellsForArray::new(vec![], true));
            }

            let rect = get_cells.rect();
            let array = sheet.cell_array(rect);
            transaction
                .cells_accessed
                .insert(rect.to_sheet_rect(sheet.id));
            self.transactions.add_async_transaction(transaction);
            Ok(array)
        } else {
            // unable to find sheet by name, generate error
            let msg = if let (Some(sheet_name), Some(line_number)) =
                (sheet_name, get_cells.line_number())
            {
                format!("Sheet '{}' not found at line {}", sheet_name, line_number)
            } else {
                "Sheet not found".to_string()
            };
            self.code_cell_sheet_error(&mut transaction, msg, get_cells.line_number())?;
            self.transactions.add_async_transaction(transaction);
            Ok(CellsForArray::new(vec![], true))
        }
    }
}
