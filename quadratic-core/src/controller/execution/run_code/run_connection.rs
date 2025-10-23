use anyhow::Result;

use crate::{
    Pos, Rect, RunError, RunErrorMsg, SheetPos,
    a1::{A1Error, A1Selection},
    controller::{GridController, active_transactions::pending_transaction::PendingTransaction},
    grid::{
        CodeCellLanguage, CodeCellValue, ConnectionKind, HANDLEBARS_REGEX_COMPILED, Sheet, SheetId,
    },
};

impl GridController {
    /// Returns a string of cells for a connection. For more than one cell, the
    /// cells are comma-delimited.
    pub fn get_cells_comma_delimited_string(sheet: &Sheet, rect: Rect) -> String {
        let mut response = String::new();
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = sheet.display_value(Pos { x, y }) {
                    if !response.is_empty() {
                        response.push(',');
                    }
                    response.push_str(&cell.to_get_cells());
                }
            }
        }
        response
    }

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

            // connections support either one cell or a 1d range of cells (ie,
            // one column or row), which are entered as a comma-delimited list
            // of entries (e.g., "2,3,10,1,...") in the query

            if !selection.is_1d_range(context) {
                return Err(A1Error::WrongCellCount(
                    "Connections only supports one cell or a 1d range of cells".to_string(),
                ));
            }

            let Some(sheet) = self.try_sheet(selection.sheet_id) else {
                return Err(A1Error::SheetNotFound);
            };

            let rects = sheet.selection_to_rects(&selection, false, false, true, context);
            if rects.len() > 1 {
                return Err(A1Error::WrongCellCount(
                    "Connections only supports one cell or a 1d range of cells".to_string(),
                ));
            }
            let rect = rects[0];
            result.push_str(&Self::get_cells_comma_delimited_string(sheet, rect));

            transaction
                .cells_accessed
                .add_sheet_rect(rect.to_sheet_rect(sheet.id));

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
        transaction.waiting_for_async_code_cell = true;
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
        grid::{CodeCellLanguage, ConnectionKind, SheetId},
        test_util::*,
    };

    #[test]
    fn test_replace_handlebars() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(pos![sheet_id!A2], "test".to_string(), None, false);

        let mut transaction = PendingTransaction::default();

        let sheet_pos = pos![sheet_id!A1];

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

        gc.add_sheet(None, None, None, false);
        let sheet_2_id = gc.sheet_ids()[1];
        gc.set_cell_value(pos![sheet_2_id!A2], "test2".to_string(), None, false);

        let code = r#"{{'Sheet2'!$A$2}}"#;
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

        gc.set_cell_value(pos![sheet_id!A2], "test".to_string(), None, false);

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

        gc.set_cell_value(pos![sheet_id!A1], "test".to_string(), None, false);

        let sheet_pos = pos![sheet_id!A2];

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
                false,
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

    #[test]
    fn test_get_cells_for_connections() {
        use crate::Rect;

        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Test single cell
        gc.set_cell_value(pos![sheet_id!A1], "test".to_string(), None, false);

        assert_eq!(
            GridController::get_cells_comma_delimited_string(
                gc.sheet(sheet_id),
                Rect::test_a1("A1")
            ),
            "test"
        );

        // Test multiple cells in the same row
        gc.set_cell_value(pos![sheet_id!A2], "123".to_string(), None, false);
        assert_eq!(
            GridController::get_cells_comma_delimited_string(
                gc.sheet(sheet_id),
                Rect::test_a1("A1:A2")
            ),
            "test,123"
        );

        // Test multiple cells in the same column
        gc.set_cell_value(pos![sheet_id!B1], "456".to_string(), None, false);
        assert_eq!(
            GridController::get_cells_comma_delimited_string(
                gc.sheet(sheet_id),
                Rect::test_a1("A1:B1")
            ),
            "test,456"
        );

        // test code cells
        gc.set_code_cell(
            pos![sheet_id!C1],
            CodeCellLanguage::Formula,
            "=A2 * 2".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            GridController::get_cells_comma_delimited_string(
                gc.sheet(sheet_id),
                Rect::test_a1("A1:C1")
            ),
            "test,456,246"
        );
    }
}
