use anyhow::Result;
use regex::{Captures, Regex};

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
        let re = Regex::new(r#"\{\{\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*"([^"]*)"\s*)?\}\}"#)
            .map_err(|err| format!("Regex compilation failed: {}", err))?;

        let result = re.replace_all(code, |caps: &Captures<'_>| {
            let replacement: Result<String, String> = (|| {
                // Parse x and y coordinates
                let x: i64 = caps[1]
                    .parse()
                    .map_err(|_| "Failed to parse x coordinate")?;
                let y: i64 = caps[2]
                    .parse()
                    .map_err(|_| "Failed to parse y coordinate")?;

                // Get the sheet where the cell is located
                let sheet = if let Some(sheet_name) = caps.get(3) {
                    self.grid()
                        .try_sheet_from_name(sheet_name.as_str().to_string())
                        .ok_or_else(|| {
                            format!("Failed to find sheet with name: {}", sheet_name.as_str())
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

            // Handle the Result, returning the replacement or the original match on error
            match replacement {
                Ok(value) => value,
                Err(err) => {
                    eprintln!("Error in replacement: {}", err);
                    caps[0].to_string()
                }
            }
        });

        Ok(result.into_owned())
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
                    let _ = self.code_cell_sheet_error(transaction, &error);
                    self.start_transaction(transaction);

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
}
