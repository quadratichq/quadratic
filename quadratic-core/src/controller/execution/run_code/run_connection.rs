use anyhow::Result;
use regex::Regex;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::{CodeCellLanguage, ConnectionKind, SheetId},
    A1Error, Pos, RunError, RunErrorMsg, SheetPos,
};

use lazy_static::lazy_static;

lazy_static! {
    static ref HANDLEBARS_REGEX: Regex =
        Regex::new(r#"\{\{(.*?)\}\}"#).expect("Failed to compile regex");
}

impl GridController {
    /// Attempts to replace handlebars with the actual value from the grid
    fn replace_handlebars(
        &self,
        transaction: &mut PendingTransaction,

        // todo: do we need this?
        _sheet_pos: SheetPos,
        code: &str,
        default_sheet_id: SheetId,
    ) -> Result<String, A1Error> {
        let mut result = String::new();
        let mut last_match_end = 0;

        for cap in HANDLEBARS_REGEX.captures_iter(code) {
            let Some(whole_match) = cap.get(0) else {
                continue;
            };

            result.push_str(&code[last_match_end..whole_match.start()]);

            let content = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");

            return todo!("a1 stuff -- only allow single cell!");

            // let (range_type, sheet_name) = A1::to_a1_range_type(content)?;

            // let sheet = if let Some(sheet_name) = sheet_name {
            //     self.grid
            //         .try_sheet_from_name(sheet_name.clone())
            //         .ok_or_else(|| A1Error::InvalidSheetName(sheet_name))
            // } else {
            //     self.grid
            //         .try_sheet(default_sheet_id)
            //         .ok_or_else(|| A1Error::InvalidSheetId(default_sheet_id.to_string()))
            // }?;

            // // Gets the display value of the cell at the cursor position of
            // // the Selection (for now we only support 1 cell)
            // let (x, y, value) =
            //  match range_type {
            //     A1RangeType::Pos(rel_pos) => (
            //         rel_pos.x.index as i64,
            //         rel_pos.y.index as i64,
            //         sheet
            //             .display_value(Pos::new(rel_pos.x.index as i64, rel_pos.y.index as i64))
            //             .map(|value| value.to_display())
            //             .unwrap_or_default(),
            //     ),
            //     _ => {
            //         return Err(A1Error::WrongCellCount(
            //             "Connections only supports one cell".to_string(),
            //         ))
            //     }
            // }
            // ;

            // transaction
            //     .cells_accessed
            //     .add_sheet_pos(SheetPos::new(sheet.id, x, y));
            // result.push_str(&value);

            // last_match_end = whole_match.end();
        }

        // Add the remaining part of the string
        result.push_str(&code[last_match_end..]);

        Ok(result)
    }

    pub(crate) fn run_connection(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
        kind: ConnectionKind,
        id: String,
    ) {
        // send the request to get the sql data via the connector to the host
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            match self.replace_handlebars(transaction, sheet_pos, &code, sheet_pos.sheet_id) {
                Ok(replaced_code) => {
                    crate::wasm_bindings::js::jsConnection(
                        transaction.id.to_string(),
                        sheet_pos.x as i32,
                        sheet_pos.y as i32,
                        sheet_pos.sheet_id.to_string(),
                        replaced_code,
                        kind,
                        id.to_owned(),
                    );
                }
                Err(msg) => {
                    let error = RunError {
                        span: None,
                        msg: RunErrorMsg::CodeRunError(std::borrow::Cow::Owned(msg.to_string())),
                    };
                    transaction.current_sheet_pos = Some(sheet_pos);
                    let _ = self.code_cell_sheet_error(transaction, &error);

                    // not ideal to clone the transaction, but we need to close it
                    self.finalize_transaction(transaction.clone());
                    return;
                }
            }
        }

        // stop the computation cycle until async returns
        transaction.current_sheet_pos = Some(sheet_pos);
        transaction.waiting_for_async = Some(CodeCellLanguage::Connection { kind, id });
        self.transactions.add_async_transaction(transaction);
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_replace_handlebars() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 2 }, "test".to_string());

        let mut transaction = PendingTransaction::default();

        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };

        let code = r#"{{$A$2}}"#;
        let result = gc
            .replace_handlebars(&mut transaction, sheet_pos, code, sheet_id)
            .unwrap();
        assert_eq!(result, "test".to_string());
        assert_eq!(transaction.cells_accessed.len(sheet_id), Some(1));
        assert!(transaction
            .cells_accessed
            .contains(SheetPos::new(sheet_id, 1, 2)));

        gc.add_sheet(None);
        let sheet_2_id = gc.sheet_ids()[1];
        let sheet_2 = gc.sheet_mut(sheet_2_id);
        sheet_2.set_cell_value(Pos { x: 1, y: 2 }, "test2".to_string());

        let code = r#"{{'Sheet 2'!$A$2}}"#;
        let result = gc
            .replace_handlebars(&mut transaction, sheet_pos, code, sheet_id)
            .unwrap();
        assert_eq!(result, "test2".to_string());
        assert_eq!(transaction.cells_accessed.len(sheet_id), Some(1));
        assert!(transaction
            .cells_accessed
            .contains(SheetPos::new(sheet_id, 1, 2)));
    }

    #[test]
    #[parallel]
    fn test_replace_handlebars_relative() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 2 }, "test".to_string());

        let mut transaction = PendingTransaction::default();

        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };

        let code = r#"{{A2}}"#;
        let result = gc
            .replace_handlebars(&mut transaction, sheet_pos, code, sheet_id)
            .unwrap();
        assert_eq!(result, "test".to_string());
        assert_eq!(transaction.cells_accessed.len(sheet_id), Some(1));
        assert!(transaction
            .cells_accessed
            .contains(SheetPos::new(sheet_id, 1, 2)));

        let code = r#"{{'Sheet 1'!A2}}"#;
        let result = gc
            .replace_handlebars(&mut transaction, sheet_pos, code, sheet_id)
            .unwrap();
        assert_eq!(result, "test".to_string());
        assert_eq!(transaction.cells_accessed.len(sheet_id), Some(1));
        assert!(transaction
            .cells_accessed
            .contains(SheetPos::new(sheet_id, 1, 2)));
    }

    #[test]
    #[parallel]
    fn test_replace_handlebars_actual_case() {
        let code = "SELECT age FROM 'public'.'test_table' WHERE name='{{A1}}' LIMIT 100";
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 1 }, "test".to_string());

        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };

        let mut transaction = PendingTransaction::default();
        let result = gc
            .replace_handlebars(&mut transaction, sheet_pos, code, sheet_id)
            .unwrap();
        assert_eq!(
            result,
            "SELECT age FROM 'public'.'test_table' WHERE name='test' LIMIT 100"
        );
    }

    #[test]
    #[parallel]
    fn test_run_connection_sheet_name_error() {
        fn test_error(gc: &mut GridController, code: &str, sheet_id: SheetId) {
            gc.set_code_cell(
                SheetPos {
                    x: 10,
                    y: 10,
                    sheet_id,
                },
                CodeCellLanguage::Connection {
                    kind: ConnectionKind::Postgres,
                    id: "test".to_string(),
                },
                code.to_string(),
                None,
            );

            let sheet = gc.sheet(sheet_id);
            let code_cell = sheet.code_run(Pos { x: 10, y: 10 });
            assert_eq!(
                code_cell.unwrap().get_error(),
                Some(RunError {
                    msg: RunErrorMsg::CodeRunError("Invalid Sheet Name: Sheet 2".into()),
                    span: None
                })
            );
        }

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        test_error(&mut gc, r#"{{'Sheet 2'!A2}}"#, sheet_id);
        test_error(&mut gc, r#"{{'Sheet 2'!$A$2}}"#, sheet_id);
    }
}
