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
            self.transactions.add_async_transaction(&transaction);
            return Err(CoreError::TransactionNotFound(
                "get_cells failed to get current_sheet_pos".to_string(),
            ));
        };

        // if sheet_name is None, use the sheet_id from the pos
        let sheet = if let Some(sheet_name) = get_cells.sheet_name() {
            if let Some(sheet) = self.try_sheet_from_name(sheet_name) {
                sheet
            } else {
                // unable to find sheet by name, generate error
                let msg = if let Some(line_number) = get_cells.line_number() {
                    format!("Sheet '{}' not found at line {}", sheet_name, line_number)
                } else {
                    format!("Sheet '{}' not found", sheet_name)
                };
                self.code_cell_sheet_error(&mut transaction, msg, get_cells.line_number())?;
                self.transactions.add_async_transaction(&transaction);
                return Ok(CellsForArray::new(vec![], true));
            }
        } else {
            self.try_sheet(current_sheet)
                .expect("get_cells failed to get sheet from id")
        };

        let transaction_type = transaction.transaction_type.clone();
        if transaction_type != TransactionType::User {
            // this should only be called for a user transaction
            return Err(CoreError::TransactionNotFound(
                "get_cells called for non-user transaction".to_string(),
            ));
        }
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
        self.transactions.add_async_transaction(&transaction);
        Ok(array)
    }
}
