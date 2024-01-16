// use fake::faker::filesystem::en::FilePath;
// use fake::faker::internet::en::FreeEmail;
// use fake::faker::name::en::{FirstName, LastName};
// use fake::Fake;
// use quadratic_core::controller::operations::operation::Operation;
// use quadratic_core::controller::GridController;
// use quadratic_core::{Array, CellValue, SheetRect};
use std::sync::Arc;

use crate::config::config;
use crate::state::State;

pub(crate) async fn new_state() -> State {
    let config = config().unwrap();
    State::new(&config).await.unwrap()
}

pub(crate) async fn new_arc_state() -> Arc<State> {
    Arc::new(new_state().await)
}

// pub(crate) fn operation(grid: &mut GridController, x: i64, y: i64, value: &str) -> Operation {
//     let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
//     let sheet_rect = SheetRect::single_pos((x, y).into(), sheet_id);
//     let value = CellValue::Text(value.into());
//     let values = Array::from(value);

//     Operation::SetCellValues { sheet_rect, values }
// }
