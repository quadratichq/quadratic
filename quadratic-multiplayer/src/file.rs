use anyhow::Result;
use quadratic_core::{
    controller::{operations::operation::Operation, GridController},
    grid::{file::import, Grid},
};

/// Load a .grid file
pub(crate) fn _load_file(file: &str) -> Result<Grid> {
    import(file)
}

/// Apply a stringified vec of operations to the grid
pub(crate) fn _apply_transaction(grid: &mut GridController, operations: String) -> Result<()> {
    let operations: Vec<Operation> = serde_json::from_str(&operations)?;
    grid.server_apply_transaction(operations);
    Ok(())
}

#[cfg(test)]
mod tests {
    use quadratic_core::{CellValue, Pos, SheetPos};

    use super::*;

    #[test]
    fn loads_a_file() {
        let file =
            _load_file(include_str!("../../rust-shared/data/grid/v1_4_simple.grid")).unwrap();

        let mut client = GridController::from_grid(file.clone());
        let sheet_id = client.sheet_ids().first().unwrap().to_owned();
        let summary = client.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".to_string(),
            None,
        );
        let sheet = client.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );

        let mut server = GridController::from_grid(file);
        let _ = _apply_transaction(&mut server, summary.operations.unwrap());
        let sheet = server.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );
    }
}
