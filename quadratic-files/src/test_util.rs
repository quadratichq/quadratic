// use fake::faker::filesystem::en::FilePath;
// use fake::faker::internet::en::FreeEmail;
// use fake::faker::name::en::{FirstName, LastName};
// use fake::Fake;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_core::controller::GridController;
use quadratic_core::{Array, CellValue, SheetRect};
use std::sync::Arc;

use crate::config::config;
use crate::state::State;

pub(crate) const TOKEN: &str = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjFaNTdkX2k3VEU2S1RZNTdwS3pEeSJ9.eyJpc3MiOiJodHRwczovL2Rldi1kdXp5YXlrNC5ldS5hdXRoMC5jb20vIiwic3ViIjoiNDNxbW44c281R3VFU0U1N0Fkb3BhN09jYTZXeVNidmRAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vZGV2LWR1enlheWs0LmV1LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNjIzNTg1MzAxLCJleHAiOjE2MjM2NzE3MDEsImF6cCI6IjQzcW1uOHNvNUd1RVNFNTdBZG9wYTdPY2E2V3lTYnZkIiwic2NvcGUiOiJyZWFkOnVzZXJzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.0MpewU1GgvRqn4F8fK_-Eu70cUgWA5JJrdbJhkCPCxXP-8WwfI-qx1ZQg2a7nbjXICYAEl-Z6z4opgy-H5fn35wGP0wywDqZpqL35IPqx6d0wRvpPMjJM75zVXuIjk7cEhDr2kaf1LOY9auWUwGzPiDB_wM-R0uvUMeRPMfrHaVN73xhAuQWVjCRBHvNscYS5-i6qBQKDMsql87dwR72DgHzMlaC8NnaGREBC-xiSamesqhKPVyGzSkFSaF3ZKpGrSDapqmHkNW9RDBE3GQ9OHM33vzUdVKOjU1g9Leb9PDt0o1U4p3NQoGJPShQ6zgWSUEaqvUZTfkbpD_DoYDRxA";

pub(crate) async fn new_state() -> State {
    let config = config().unwrap();
    State::new(&config).await.unwrap()
}

pub(crate) async fn new_arc_state() -> Arc<State> {
    Arc::new(new_state().await)
}

pub(crate) fn operation(grid: &mut GridController, x: i64, y: i64, value: &str) -> Operation {
    let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
    let sheet_rect = SheetRect::single_pos((x, y).into(), sheet_id);
    let value = CellValue::Text(value.into());
    let values = Array::from(value);

    Operation::SetCellValues { sheet_rect, values }
}
