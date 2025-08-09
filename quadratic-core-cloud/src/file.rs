use uuid::Uuid;

use quadratic_core::{
    controller::{GridController, operations::operation::Operation},
    grid::{
        Grid,
        file::{export, import},
    },
};
use quadratic_rust_shared::storage::{Storage, StorageContainer};

use crate::error::{CoreCloudError, Result};

pub static GROUP_NAME: &str = "quadratic-core-cloud-1";

/// Load a .grid file
pub(crate) fn load_file(key: &str, file: Vec<u8>) -> Result<Grid> {
    import(file).map_err(|e| CoreCloudError::ImportFile(key.into(), e.to_string()))
}

/// Exports a .grid file
pub(crate) fn export_file(key: &str, grid: Grid) -> Result<Vec<u8>> {
    export(grid).map_err(|e| CoreCloudError::ExportFile(key.into(), e.to_string()))
}

/// Apply a vec of operations to the grid
pub(crate) fn apply_transaction(grid: &mut GridController, operations: Vec<Operation>) {
    grid.server_apply_transaction(operations, None)
}

/// Loads a .grid file
pub(crate) async fn get_and_load_object(
    storage: &StorageContainer,
    key: &str,
    sequence_num: u64,
) -> Result<GridController> {
    let body = storage
        .read(key)
        .await
        .map_err(|e| CoreCloudError::LoadFile(key.into(), e.to_string()))?;
    let grid = load_file(key, body.to_vec())?;

    Ok(GridController::from_grid(grid, sequence_num))
}

pub(crate) fn file_key(file_id: Uuid, sequence: u64) -> String {
    format!("{file_id}-{sequence}.grid")
}

#[cfg(test)]
mod tests {}
