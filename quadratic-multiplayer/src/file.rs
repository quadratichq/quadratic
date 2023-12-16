use quadratic_core::{
    controller::{operation::Operation, transaction_summary::TransactionSummary, GridController},
    grid::{file::import, Grid},
};

use crate::error::{MpError, Result};

/// Load a .grid file
pub(crate) fn _load_file(file: &str) -> Result<Grid> {
    import(file).map_err(|e| MpError::FileService(e.to_string()))
}

/// Apply a stringified vec of operations to the grid
pub(crate) fn _apply_string_operations(
    grid: &mut GridController,
    operations: String,
) -> Result<TransactionSummary> {
    let operations: Vec<Operation> = serde_json::from_str(&operations)?;

    _apply_operations(grid, operations)
}

/// Apply a vec of operations to the grid
pub(crate) fn _apply_operations(
    grid: &mut GridController,
    operations: Vec<Operation>,
) -> Result<TransactionSummary> {
    Ok(grid.apply_received_transaction(operations))
}

#[cfg(test)]
mod tests {
    use quadratic_core::test_util::assert_cell_value;
    use quadratic_core::{Array, CellValue, SheetPos};

    use super::*;

    #[test]
    fn loads_a_file() {
        let file =
            _load_file(include_str!("../../rust-shared/data/grid/v1_4_simple.grid")).unwrap();

        let mut grid = GridController::from_grid(file);
        let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
        let sheet_rect = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        }
        .into();
        let value = CellValue::Text("hello".to_string());
        let values = Array::from(value);
        let operation = Operation::SetCellValues { sheet_rect, values };

        let _ = _apply_operations(&mut grid, vec![operation]);

        assert_cell_value(&grid, sheet_id, 0, 0, "hello");
    }
}
