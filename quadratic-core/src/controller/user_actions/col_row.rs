use crate::{
    CopyFormats,
    controller::{
        GridController, active_transactions::transaction_name::TransactionName,
        operations::operation::Operation,
    },
    grid::SheetId,
};

impl GridController {
    pub fn delete_columns(&mut self, sheet_id: SheetId, columns: Vec<i64>, cursor: Option<String>) {
        let ops = vec![Operation::DeleteColumns {
            sheet_id,
            columns,
            copy_formats: CopyFormats::After,
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    /// Note the after is providing the source column, not the direction of the
    /// insertion. DF: While confusing, it was created originally to support
    /// copying formats, but later turned into a differentiator for inserting
    /// columns, since the behavior was different for insert to left vs right.
    pub fn insert_column(
        &mut self,
        sheet_id: SheetId,
        column: i64,
        after: bool,
        cursor: Option<String>,
    ) {
        let ops = vec![Operation::InsertColumn {
            sheet_id,
            column,
            copy_formats: if after {
                CopyFormats::After
            } else {
                CopyFormats::Before
            },
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    pub fn delete_rows(&mut self, sheet_id: SheetId, rows: Vec<i64>, cursor: Option<String>) {
        let ops = vec![Operation::DeleteRows {
            sheet_id,
            rows,
            copy_formats: CopyFormats::None,
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    pub fn insert_row(&mut self, sheet_id: SheetId, row: i64, after: bool, cursor: Option<String>) {
        let ops = vec![Operation::InsertRow {
            sheet_id,
            row,
            copy_formats: if after {
                CopyFormats::After
            } else {
                CopyFormats::Before
            },
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    pub fn move_columns(
        &mut self,
        sheet_id: SheetId,
        col_start: i64,
        col_end: i64,
        to: i64,
        cursor: Option<String>,
    ) {
        let ops = vec![Operation::MoveColumns {
            sheet_id,
            col_start,
            col_end,
            to,
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

    pub fn move_rows(
        &mut self,
        sheet_id: SheetId,
        row_start: i64,
        row_end: i64,
        to: i64,
        cursor: Option<String>,
    ) {
        let ops = vec![Operation::MoveRows {
            sheet_id,
            row_start,
            row_end,
            to,
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        CellValue, Pos, SheetPos,
        grid::{CodeCellLanguage, CodeCellValue, formats::Format},
    };

    use super::*;

    #[test]
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

        gc.delete_rows(sheet_id, vec![1], None);

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
    fn delete_row_undo_values_code() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos::new(sheet_id, 1, 1),
            vec![vec!["1".into()], vec!["2".into()], vec!["3".into()]],
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

        gc.delete_rows(sheet_id, vec![2], None);

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

    #[test]
    fn column_insert_formatting_after() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, Some(1), None, Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(Pos::new(1, 1), Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string())
        );

        gc.insert_column(sheet_id, 1, true, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new column that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![A1]),
            Some("blue".to_string())
        );

        // this is the original column that was shifted right (with the original formatting)
        assert_eq!(
            sheet.formats.fill_color.get(pos![B1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![B1]),
            Some("blue".to_string())
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![B1]).is_default());
    }

    #[test]
    fn column_insert_formatting_before() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, Some(1), None, Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(pos![A1], Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.insert_column(sheet_id, 2, false, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new column that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.formats.format(pos![B1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![D1]).is_default());
        assert!(sheet.formats.format(pos![B1]).is_default());
    }

    #[test]
    fn row_insert_formatting_after() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, None, Some(1), Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(pos![A1], Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.insert_row(sheet_id, 1, true, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new row that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.formats.format(pos![A2]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![D2]).is_default());
        assert!(sheet.formats.format(pos![B2]).is_default());
    }

    #[test]
    fn row_insert_formatting_before() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, None, Some(1), Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(Pos::new(1, 1), Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.insert_row(sheet_id, 2, false, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new row that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.formats.format(pos![A2]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![A2]).is_default());
        assert!(sheet.formats.format(pos![B2]).is_default());
    }
}
