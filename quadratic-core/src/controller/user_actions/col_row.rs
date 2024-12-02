use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::SheetId,
    CopyFormats,
};

impl GridController {
    pub fn delete_columns(
        &mut self,
        sheet_id: SheetId,
        mut columns: Vec<i64>,
        cursor: Option<String>,
    ) {
        columns.sort_unstable();
        columns.dedup();
        columns.reverse();
        let ops = columns
            .into_iter()
            .map(|column| Operation::DeleteColumn { sheet_id, column })
            .collect();
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }

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

    pub fn delete_rows(&mut self, sheet_id: SheetId, mut rows: Vec<i64>, cursor: Option<String>) {
        rows.sort_unstable();
        rows.dedup();
        rows.reverse();
        let ops = rows
            .iter()
            .map(|row| Operation::DeleteRow {
                sheet_id,
                row: *row,
            })
            .collect();
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
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        grid::{
            formats::{format::Format, format_update::FormatUpdate, Formats},
            CodeCellLanguage, CodeCellValue,
        },
        CellValue, Pos, SheetPos,
    };

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
    #[parallel]
    fn column_insert_formatting_after() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_formats_columns(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    text_color: Some(Some("blue".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_format_cell(
            Pos::new(1, 1),
            &FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
            false,
        );
        sheet.recalculate_bounds();

        assert_eq!(
            sheet.format_cell(1, 1, false),
            Format {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );

        gc.insert_column(sheet_id, 1, true, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new column that was inserted (with the copied formatting)
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.format_cell(2, 1, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.format_cell(0, 1, true).is_default());
        assert!(sheet.format_cell(2, 1, true).is_default());
    }

    #[test]
    #[parallel]
    fn column_insert_formatting_before() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_formats_columns(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    text_color: Some(Some("blue".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_format_cell(
            Pos::new(1, 1),
            &FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
            false,
        );
        sheet.recalculate_bounds();

        assert_eq!(
            sheet.format_cell(1, 1, false),
            Format {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );

        gc.insert_column(sheet_id, 2, false, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new column that was inserted (with the copied formatting)
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.format_cell(2, 1, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.format_cell(0, 1, true).is_default());
        assert!(sheet.format_cell(2, 1, true).is_default());
    }

    #[test]
    #[parallel]
    fn row_insert_formatting_after() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_formats_rows(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    text_color: Some(Some("blue".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_format_cell(
            Pos::new(1, 1),
            &FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
            false,
        );
        sheet.recalculate_bounds();

        assert_eq!(
            sheet.format_cell(1, 1, false),
            Format {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );

        gc.insert_row(sheet_id, 1, true, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new row that was inserted (with the copied formatting)
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.format_cell(1, 2, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.format_cell(1, 0, true).is_default());
        assert!(sheet.format_cell(1, 2, true).is_default());
    }

    #[test]
    #[parallel]
    fn row_insert_formatting_before() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_formats_rows(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    text_color: Some(Some("blue".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_format_cell(
            Pos::new(1, 1),
            &FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
            false,
        );
        sheet.recalculate_bounds();

        assert_eq!(
            sheet.format_cell(1, 1, false),
            Format {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );

        gc.insert_row(sheet_id, 2, false, None);

        let sheet = gc.sheet(sheet_id);

        // this is the new row that was inserted (with the copied formatting)
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.format_cell(1, 2, true),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.format_cell(1, 1, true),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.format_cell(1, 0, true).is_default());
        assert!(sheet.format_cell(1, 2, true).is_default());
    }
}
