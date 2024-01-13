/// These are all user-initiated actions on the grid.
///
pub mod auto_complete;
pub mod borders;
pub mod cells;
pub mod clipboard;
pub mod formatting;
pub mod import;
pub mod sheets;
pub mod undo;

#[cfg(test)]
mod test {
    use crate::{controller::GridController, SheetPos};

    #[test]
    fn test() {
        let mut client = GridController::test();
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
        dbg!(&summary.operations.unwrap());
    }
}
