use anyhow::Result;
use quadratic_core::{
    controller::{operation::Operation, transaction_summary::TransactionSummary, GridController},
    grid::{file::import, Grid},
};

pub(crate) fn load_file(file: &str) -> Result<Grid> {
    import(file)
}

pub(crate) fn apply_string_operations(
    grid: &mut GridController,
    operations: String,
) -> Result<TransactionSummary> {
    tracing::info!("Applying operations: {}", operations);

    let operations: Vec<Operation> = serde_json::from_str(&operations)?;

    for operation in operations.clone().into_iter() {
        tracing::trace!("Applying operation: {:?}", operation);
    }

    apply_operations(grid, operations)
}

pub(crate) fn apply_operations(
    grid: &mut GridController,
    operations: Vec<Operation>,
) -> Result<TransactionSummary> {
    Ok(grid.apply_received_transaction(operations))
}

#[cfg(test)]
mod tests {
    use quadratic_core::{grid::SheetId, Array, CellValue, Pos, Rect};

    use super::*;

    /// Run an assertion that a cell value is equal to the given value
    pub fn assert_cell_value(
        grid_controller: &GridController,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        value: &str,
    ) {
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let cell_value = sheet
            .get_cell_value(Pos { x, y })
            .unwrap_or(CellValue::Blank);
        let expected = if value.is_empty() {
            CellValue::Blank
        } else {
            CellValue::to_cell_value(value)
        };

        assert_eq!(
            cell_value, expected,
            "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
            x, y, expected, cell_value
        );
    }

    #[test]
    fn loads_a_file() {
        let file = load_file(include_str!("../examples/data/v1_4_simple.grid")).unwrap();

        let mut grid = GridController::from_grid(file);
        let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
        let rect = Rect::js_single_pos((0, 0).into());
        let (region, _) = grid.region(sheet_id, rect);
        let value = CellValue::Text("hello".to_string());
        let values = Array::from(value);
        let operation = Operation::SetCellValues { region, values };

        let _ = apply_operations(&mut grid, vec![operation]);

        assert_cell_value(&grid, sheet_id, 0, 0, "hello");
    }
}
