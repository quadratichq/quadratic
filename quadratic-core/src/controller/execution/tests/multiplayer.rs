#[cfg(test)]
mod tests {
    use crate::{controller::GridController, CellValue, Pos, SheetPos};

    #[test]
    fn test_multiplayer_hello_world() {
        let mut gc1 = GridController::new();
        let sheet_id = gc1.sheet_ids()[0];
        let summary = gc1.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World".to_string(),
            None,
        );
        let sheet = gc1.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );

        // received its own transaction back...
        gc1.received_transaction(summary.forward_operations.clone().unwrap());
        let sheet = gc1.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );

        let mut gc2 = GridController::new();
        gc2.grid_mut().sheets_mut()[0].id = sheet_id;
        gc2.received_transaction(summary.forward_operations.unwrap());
        let sheet = gc2.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );
    }
}
