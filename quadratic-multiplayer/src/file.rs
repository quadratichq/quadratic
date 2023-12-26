use anyhow::Result;
use quadratic_core::{
    controller::{GridController, Transaction},
    grid::{file::import, Grid},
};

/// Load a .grid file
pub(crate) fn _load_file(file: &str) -> Result<Grid> {
    import(file)
}

/// Apply a stringified vec of operations to the grid
pub(crate) fn _apply_transaction(grid: &mut GridController, transaction: String) -> Result<()> {
    let transaction: Transaction = serde_json::from_str(&transaction)?;
    grid.server_apply_transaction(transaction);
    Ok(())
}

#[cfg(test)]
mod tests {
    use quadratic_core::test_util::assert_cell_value;
    use quadratic_core::SheetPos;

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
        assert_cell_value(&client, sheet_id, 0, 0, "hello");

        let mut server = GridController::from_grid(file);
        let _ = _apply_transaction(&mut server, summary.transaction.unwrap());

        assert_cell_value(&server, sheet_id, 0, 0, "hello");
    }
}
