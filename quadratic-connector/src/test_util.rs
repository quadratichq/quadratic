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
    State::new(&config, None)
}

pub(crate) async fn new_arc_state() -> Arc<State> {
    Arc::new(new_state().await)
}
