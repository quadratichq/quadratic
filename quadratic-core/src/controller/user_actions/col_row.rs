use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::SheetId,
};

impl GridController {
    pub fn delete_column(&mut self, sheet_id: SheetId, column: i64, cursor: Option<String>) {
        let ops = vec![Operation::DeleteColumn { sheet_id, column }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    pub fn insert_column(&mut self, sheet_id: SheetId, column: i64, cursor: Option<String>) {
        let ops = vec![Operation::InsertColumn { sheet_id, column }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    pub fn delete_row(&mut self, sheet_id: SheetId, row: i64, cursor: Option<String>) {
        let ops = vec![Operation::DeleteRow { sheet_id, row }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    pub fn insert_row(&mut self, sheet_id: SheetId, row: i64, cursor: Option<String>) {
        let ops = vec![Operation::InsertRow { sheet_id, row }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{grid::CodeCellLanguage, CellValue, CodeCellValue, Pos, SheetPos};

    use super::*;

    #[test]
    #[parallel]
    fn delete_row_undo_code() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Formula,
            "1".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos::new(1, 1)),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "1".to_string()
            }))
        );

        gc.delete_row(sheet_id, 1, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.cell_value(Pos::new(1, 1)), None);

        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos::new(1, 1)),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "1".to_string()
            }))
        );
    }

    #[test]
    #[parallel]
    fn delete_row_undo_values_code() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos::new(sheet_id, 1, 1),
            vec![vec!["1"], vec!["2"], vec!["3"]],
            None,
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 2, 2),
            CodeCellLanguage::Formula,
            "5".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos::new(2, 2)),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "5".to_string()
            }))
        );

        gc.delete_row(sheet_id, 2, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos::new(1, 2)),
            Some(CellValue::Number(3.into()))
        );

        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos::new(1, 2)),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.cell_value(Pos::new(2, 2)),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "5".to_string()
            }))
        );
    }
}
