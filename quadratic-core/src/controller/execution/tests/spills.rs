#[cfg(test)]
mod tests {
    use crate::{controller::GridController, grid::CodeCellLanguage, CellValue, Pos, SheetPos};

    #[test]
    fn test_spilled_output_over_normal_cell() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid.sheet_mut_from_id(sheet_id);
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text("one".into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Text("two".into()));
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A0:A1".to_string(),
            None,
        );
        let sheet = gc.grid.sheet_from_id(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("one".into()))
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("two".into()))
        );
        assert_eq!(sheet.get_cell_value(Pos { x: 0, y: 2 }), None);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Text("one".into()))
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("two".into()))
        );

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "cause spill".to_string(),
            None,
        );

        let sheet = gc.grid.sheet_from_id(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("cause spill".into()))
        );
        assert_eq!(sheet.get_cell_value(Pos { x: 1, y: 0 }), None);
        // let code_cell = sheet.get_code_cell(Pos { x: 1, y: 0 });
        // assert!(code_cell.unwrap().has_spill_error());
    }
}
