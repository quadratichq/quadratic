use anyhow::Result;

use crate::{
    RunError, RunErrorMsg, SheetPos,
    a1::{A1Error, A1Selection},
    controller::{GridController, active_transactions::pending_transaction::PendingTransaction},
    grid::{ConnectionKind, HANDLEBARS_REGEX_COMPILED, SheetId},
};

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

        let context = self.a1_context();
        for cap in HANDLEBARS_REGEX_COMPILED.captures_iter(code) {
            let Ok(cap) = cap else {
                continue;
            };

            let Some(whole_match) = cap.get(0) else {
                continue;
            };

            result.push_str(&code[last_match_end..whole_match.start()]);

            let content = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");
            let selection = A1Selection::parse_a1(content, default_sheet_id, context)?;

            let Some(pos) = selection.try_to_pos(context) else {
                return Err(A1Error::WrongCellCount(
                    "Connections only supports one cell".to_string(),
                ));
            };

            let Some(sheet) = self.try_sheet(selection.sheet_id) else {
                return Err(A1Error::SheetNotFound);
            };

            let value = sheet
                .display_value(pos)
                .map(|value| value.to_display())
                .unwrap_or_default();

            transaction
                .cells_accessed
                .add_sheet_pos(SheetPos::new(sheet.id, pos.x, pos.y));
            result.push_str(&value);

            last_match_end = whole_match.end();
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
        transaction.waiting_for_async = true;
        self.transactions.add_async_transaction(transaction);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        Pos, RunError, RunErrorMsg, SheetPos,
        constants::SHEET_NAME,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
        },
        grid::{CodeCellLanguage, SheetId},
    };

    #[test]
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
        assert!(
            transaction
                .cells_accessed
                .contains(SheetPos::new(sheet_id, 1, 2), gc.a1_context())
        );

        gc.add_sheet(None, None, None);
        let sheet_2_id = gc.sheet_ids()[1];
        let sheet_2 = gc.sheet_mut(sheet_2_id);
        sheet_2.set_cell_value(Pos { x: 1, y: 2 }, "test2".to_string());

        let code = r#"{{'Sheet 2'!$A$2}}"#;
        let result = gc
            .replace_handlebars(&mut transaction, sheet_pos, code, sheet_id)
            .unwrap();
        assert_eq!(result, "test2".to_string());
        assert_eq!(transaction.cells_accessed.len(sheet_id), Some(1));
        assert!(
            transaction
                .cells_accessed
                .contains(SheetPos::new(sheet_id, 1, 2), gc.a1_context())
        );
    }

    #[test]
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
        let context = gc.a1_context();
        assert!(
            transaction
                .cells_accessed
                .contains(SheetPos::new(sheet_id, 1, 2), context)
        );

        let code = format!(r#"{{{{'{SHEET_NAME}1'!A2}}}}"#);
        let result = gc
            .replace_handlebars(&mut transaction, sheet_pos, &code, sheet_id)
            .unwrap();
        assert_eq!(result, "test".to_string());
        assert_eq!(transaction.cells_accessed.len(sheet_id), Some(1));
        assert!(
            transaction
                .cells_accessed
                .contains(SheetPos::new(sheet_id, 1, 2), context)
        );
    }

    #[test]
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
                None,
            );

            let sheet = gc.sheet(sheet_id);
            let code_cell = sheet.data_table_at(&Pos { x: 10, y: 10 });
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
