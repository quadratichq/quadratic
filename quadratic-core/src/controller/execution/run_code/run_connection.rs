use anyhow::Result;
use regex::Regex;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::{CodeCellLanguage, ConnectionKind, SheetId},
    Pos, RunError, RunErrorMsg, SheetPos, SheetRect,
};

impl GridController {
    /// Attempts to replace handlebars with the actual value from the grid
    fn replace_handlebars(
        &self,
        transaction: &mut PendingTransaction,
        code: &str,
        default_sheet_id: SheetId,
    ) -> Result<String, String> {
        let re = Regex::new(r#"\{\{\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*"?([^"]*)"?\s*)?\}\}"#)
            .map_err(|err| format!("Regex compilation failed: {}", err))?;

        let mut result = String::new();
        let mut last_match_end = 0;

        for cap in re.captures_iter(code) {
            let whole_match = cap.get(0).unwrap();
            result.push_str(&code[last_match_end..whole_match.start()]);

            let replacement: Result<String, String> = (|| {
                // Parse x and y coordinates
                let x: i64 = cap[1].parse().map_err(|_| "Failed to parse x coordinate")?;
                let y: i64 = cap[2].parse().map_err(|_| "Failed to parse y coordinate")?;

                // Get the sheet where the cell is located
                let sheet = if let Some(sheet_name) = cap.get(3) {
                    let sheet_name = sheet_name.as_str().trim().to_string();
                    self.grid()
                        .try_sheet_from_name(sheet_name.clone())
                        .ok_or_else(|| {
                            format!("Failed to find sheet with name: '{}'", sheet_name)
                        })?
                } else {
                    self.try_sheet(default_sheet_id).ok_or_else(|| {
                        format!("Failed to find sheet with id: {}", default_sheet_id)
                    })?
                };

                transaction
                    .cells_accessed
                    .insert(SheetRect::new(x, y, x, y, sheet.id));

                if let Some(cell) = sheet.display_value(Pos { x, y }) {
                    Ok(cell.to_string())
                } else {
                    Ok(String::new())
                }
            })();

            match replacement {
                Ok(value) => result.push_str(&value),
                Err(err) => return Err(err),
            }

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
            match self.replace_handlebars(transaction, &code, sheet_pos.sheet_id) {
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
                        msg: RunErrorMsg::PythonError(msg.to_owned().into()),
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
    fn replace_handlebars() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 2 }, "test".to_string());

        let mut transaction = PendingTransaction::default();

        let code = r#"{{ 1, 2 }}"#;
        let result = gc
            .replace_handlebars(&mut transaction, code, sheet_id)
            .unwrap();
        assert_eq!(result, "test".to_string());
        assert_eq!(transaction.cells_accessed.len(), 1);
        assert_eq!(
            transaction
                .cells_accessed
                .contains(&SheetRect::new(1, 2, 1, 2, sheet_id)),
            true
        );

        gc.add_sheet(None);
        let sheet_2_id = gc.sheet_ids()[1];
        let sheet_2 = gc.sheet_mut(sheet_2_id);
        sheet_2.set_cell_value(Pos { x: 1, y: 2 }, "test2".to_string());

        let code = r#"{{ 1, 2, "Sheet 2" }}"#;
        let result = gc
            .replace_handlebars(&mut transaction, code, sheet_id)
            .unwrap();
        assert_eq!(result, "test2".to_string());
        assert_eq!(transaction.cells_accessed.len(), 2);
        assert_eq!(
            transaction
                .cells_accessed
                .contains(&SheetRect::new(1, 2, 1, 2, sheet_2_id)),
            true
        );
    }

    #[test]
    #[parallel]
    fn run_connection_sheet_name_error() {
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
                    msg: RunErrorMsg::PythonError(
                        "Failed to find sheet with name: 'Sheet 2'".into()
                    ),
                    span: None
                })
            );
        }

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        test_error(&mut gc, r#"{{ 1, 2, "Sheet 2" }}"#, sheet_id);
        test_error(&mut gc, r#"{{ 1, 2, Sheet 2 }}"#, sheet_id);
        test_error(&mut gc, r#"{{1,2,Sheet 2}}"#, sheet_id);
        test_error(&mut gc, r#"{{1,2,"Sheet 2"}}"#, sheet_id);
    }
}
