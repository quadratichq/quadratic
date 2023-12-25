#[cfg(test)]
mod tests {
    use bigdecimal::BigDecimal;

    use crate::{controller::GridController, CellValue, Pos, SheetPos};

    #[test]
    fn test_set_cell_value() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "0".to_string(),
            None,
        );

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(0)))
        );

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "1".to_string(),
            None,
        );

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
    }
}
