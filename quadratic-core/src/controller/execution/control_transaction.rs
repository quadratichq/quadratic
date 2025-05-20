use uuid::Uuid;

use super::{GridController, TransactionSource};
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::operation::Operation;
use crate::controller::transaction::Transaction;
use crate::controller::transaction_types::JsCodeResult;
use crate::error_core::{CoreError, Result};
use crate::grid::{CodeCellLanguage, CodeRun, ConnectionKind, DataTable, DataTableKind};
use crate::parquet::parquet_to_vec;
use crate::renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH};
use crate::{CellValue, Pos, RunError, RunErrorMsg, Value};

impl GridController {
    // loop compute cycle until complete or an async call is made
    pub(super) fn start_transaction(&mut self, transaction: &mut PendingTransaction) {
        if cfg!(target_family = "wasm") || cfg!(test) {
            let transaction_name = serde_json::to_string(&transaction.transaction_name)
                .unwrap_or("Unknown".to_string());
            crate::wasm_bindings::js::jsTransactionStart(
                transaction.id.to_string(),
                transaction_name,
            );
        }

        #[cfg(feature = "show-first-sheet-operations")]
        if transaction.is_undo() {
            println!("\n========= Starting undo transaction =========\n");
        } else if transaction.is_redo() {
            println!("\n========= Starting redo transaction =========\n");
        } else {
            println!(
                "\n========= Starting transaction {:?} =========\n",
                transaction.transaction_name
            );
        }

        loop {
            if transaction.operations.is_empty() && transaction.resize_rows.is_empty() {
                transaction.complete = true;
                break;
            }

            self.execute_operation(transaction);
            self.send_transaction_progress(transaction);
            self.send_sheet_info(transaction);
            self.send_code_cells(transaction);
            self.process_visible_dirty_hashes(transaction);

            if transaction.has_async > 0 {
                self.transactions.update_async_transaction(transaction);
                break;
            }

            if transaction.operations.is_empty() {
                if let Some((sheet_id, rows)) = transaction
                    .resize_rows
                    .iter()
                    .next()
                    .map(|(&k, v)| (k, v.clone()))
                {
                    transaction.resize_rows.remove(&sheet_id);

                    self.send_offsets_modified(transaction);
                    let resizing = self.start_auto_resize_row_heights(
                        transaction,
                        sheet_id,
                        rows.into_iter().collect(),
                    );
                    // break only if async resize operation is being executed
                    if resizing {
                        break;
                    }
                }
            }
        }

        self.process_visible_dirty_hashes(transaction);
        self.process_remaining_dirty_hashes(transaction);
    }

    /// Finalizes the transaction and pushes it to the various stacks (if needed)
    pub(super) fn finalize_transaction(&mut self, mut transaction: PendingTransaction) {
        if transaction.has_async > 0 {
            self.transactions.update_async_transaction(&transaction);
            return;
        }

        if !transaction.complete {
            return;
        }

        match transaction.source {
            TransactionSource::User => {
                let undo = transaction.to_undo_transaction();
                self.undo_stack.push(undo);
                self.redo_stack.clear();
                self.transactions
                    .unsaved_transactions
                    .insert_or_replace(&transaction, true);
            }
            TransactionSource::Unsaved => {
                let undo = transaction.to_undo_transaction();
                self.undo_stack.push(undo);
                self.redo_stack.clear();
            }
            TransactionSource::Undo => {
                let undo = transaction.to_undo_transaction();
                self.redo_stack.push(undo);
                self.transactions
                    .unsaved_transactions
                    .insert_or_replace(&transaction, true);
            }
            TransactionSource::Redo => {
                let undo = transaction.to_undo_transaction();
                self.undo_stack.push(undo);
                self.transactions
                    .unsaved_transactions
                    .insert_or_replace(&transaction, true);
            }
            TransactionSource::Multiplayer => (),
            TransactionSource::Server => (),
            TransactionSource::Unset => panic!("Expected a transaction type"),
        }

        self.send_transaction_client_updates(&mut transaction);

        transaction.send_transaction();

        if cfg!(target_family = "wasm") || cfg!(test) {
            let transaction_name = serde_json::to_string(&transaction.transaction_name)
                .unwrap_or("Unknown".to_string());
            crate::wasm_bindings::js::jsTransactionEnd(
                transaction.id.to_string(),
                transaction_name,
            );
        }
    }

    pub fn start_user_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
        transaction_name: TransactionName,
    ) -> String {
        let mut transaction = PendingTransaction {
            source: TransactionSource::User,
            operations: operations.into(),
            cursor,
            transaction_name,
            ..Default::default()
        };
        let transaction_id = transaction.id.to_string();
        self.start_transaction(&mut transaction);
        self.finalize_transaction(transaction);
        transaction_id
    }

    pub fn start_undo_transaction(
        &mut self,
        transaction: Transaction,
        transaction_type: TransactionSource,
        cursor: Option<String>,
    ) {
        let mut pending = transaction.to_undo_transaction(transaction_type, cursor);
        pending.id = Uuid::new_v4();
        self.start_transaction(&mut pending);
        self.finalize_transaction(pending);
    }

    /// Externally called when an async calculation completes
    pub fn calculation_complete(&mut self, result: JsCodeResult) -> Result<()> {
        let transaction_id = Uuid::parse_str(&result.transaction_id)?;
        let mut transaction = self.transactions.remove_awaiting_async(transaction_id)?;

        if result.cancel_compute.unwrap_or(false) {
            self.start_transaction(&mut transaction);
        }

        self.after_calculation_async(&mut transaction, result)?;
        self.finalize_transaction(transaction);
        Ok(())
    }

    /// Externally called when an async connection completes
    pub fn connection_complete(
        &mut self,
        transaction_id: String,
        data: Vec<u8>,
        std_out: Option<String>,
        std_err: Option<String>,
        extra: Option<String>,
    ) -> Result<()> {
        let transaction_id = Uuid::parse_str(&transaction_id)?;
        let mut transaction = self.transactions.remove_awaiting_async(transaction_id)?;
        let array = parquet_to_vec(data)?;

        if let Some(current_sheet_pos) = transaction.current_sheet_pos {
            let mut return_type = if array.is_empty() {
                "0×0 Array".to_string()
            } else {
                // subtract 1 from the length to account for the header row
                format!("{}×{} Array", array[0].len(), 0.max(array.len() - 1))
            };

            if let Some(extra) = extra {
                return_type = format!("{return_type}\n{extra}");
            }

            let error = std_err.to_owned().map(|msg| RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError(msg.into()),
            });

            let value = if std_err.is_some() {
                Value::default() // TODO(ddimaria): this will be an empty vec
            } else {
                Value::Array(array.into())
            };

            let Some(sheet) = self.try_sheet(current_sheet_pos.sheet_id) else {
                return Err(CoreError::CodeCellSheetError("Sheet not found".to_string()));
            };
            let Some(CellValue::Code(code)) = sheet.cell_value_ref(current_sheet_pos.into()) else {
                return Err(CoreError::CodeCellSheetError(
                    "Code cell not found".to_string(),
                ));
            };

            let code_run = CodeRun {
                language: code.language.to_owned(),
                code: code.code.to_owned(),
                error,
                return_type: Some(return_type.to_owned()),
                line_number: Some(1),
                output_type: Some(return_type),
                std_out,
                std_err: std_err.to_owned(),
                cells_accessed: transaction.cells_accessed.to_owned(),
            };

            let name = match code.language {
                CodeCellLanguage::Connection { kind, .. } => match kind {
                    ConnectionKind::Postgres => "Postgres1",
                    ConnectionKind::Mysql => "MySQL1",
                    ConnectionKind::Mssql => "MSSQL1",
                    ConnectionKind::Snowflake => "Snowflake1",
                },
                // this should not happen
                _ => "Connection 1",
            };
            let data_table = DataTable::new(
                DataTableKind::CodeRun(code_run),
                name,
                value,
                false,
                true,
                None,
                None,
                None,
            );

            self.finalize_data_table(&mut transaction, current_sheet_pos, Some(data_table), None);
            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
        }

        Ok(())
    }
}

#[derive(Debug, PartialEq)]
pub struct CellHash(String);

impl CellHash {
    pub fn get(&self) -> String {
        self.0.clone()
    }
}

impl From<Pos> for CellHash {
    fn from(pos: Pos) -> Self {
        let hash_width = CELL_SHEET_WIDTH as f64;
        let hash_height = CELL_SHEET_HEIGHT as f64;
        let cell_hash_x = (pos.x as f64 / hash_width).floor() as i64;
        let cell_hash_y = (pos.y as f64 / hash_height).floor() as i64;
        let cell_hash = format!("{},{}", cell_hash_x, cell_hash_y);

        CellHash(cell_hash)
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::cell_values::CellValues;
    use crate::controller::transaction_types::JsCellValueResult;
    use crate::grid::{CodeCellLanguage, ConnectionKind, GridBounds};
    use crate::{CellValue, Pos, Rect, SheetPos};

    fn add_cell_value(sheet_pos: SheetPos, values: CellValues) -> Operation {
        Operation::SetCellValues { sheet_pos, values }
    }

    fn get_operations(gc: &mut GridController) -> (Operation, Operation) {
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos::from((0, 0, sheet_id));
        let value = CellValue::Text("test".into());
        let operation = add_cell_value(sheet_pos, value.into());
        let operation_undo = add_cell_value(sheet_pos, CellValues::new(1, 1));
        (operation, operation_undo)
    }

    #[test]
    fn test_transactions_finalize_transaction() {
        let mut gc = GridController::test();
        let (operation, operation_undo) = get_operations(&mut gc);

        // TransactionType::User
        let mut transaction = PendingTransaction {
            source: TransactionSource::User,
            operations: vec![operation].into(),
            ..Default::default()
        };
        gc.start_transaction(&mut transaction);
        gc.finalize_transaction(transaction);

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 0);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);

        // TransactionType::Undo
        let mut transaction = PendingTransaction {
            source: TransactionSource::Undo,
            operations: vec![operation_undo.clone()].into(),
            ..Default::default()
        };
        gc.start_transaction(&mut transaction);
        gc.finalize_transaction(transaction);

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 1);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);
        assert_eq!(gc.redo_stack[0].operations.len(), 1);

        // TransactionType::Redo
        let mut transaction = PendingTransaction {
            source: TransactionSource::Redo,
            operations: vec![operation_undo.clone()].into(),
            ..Default::default()
        };
        gc.start_transaction(&mut transaction);
        gc.finalize_transaction(transaction);

        assert_eq!(gc.undo_stack.len(), 2);
        assert_eq!(gc.redo_stack.len(), 1);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);
        assert_eq!(gc.redo_stack[0].operations.len(), 1);
    }

    #[test]
    fn test_transactions_undo_redo() {
        let mut gc = GridController::test();
        let (operation, operation_undo) = get_operations(&mut gc);

        assert!(!gc.has_undo());
        assert!(!gc.has_redo());

        gc.start_user_transaction(vec![operation.clone()], None, TransactionName::Unknown);
        assert!(gc.has_undo());
        assert!(!gc.has_redo());
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);

        // undo
        gc.undo(None);
        assert!(!gc.has_undo());
        assert!(gc.has_redo());

        // redo
        gc.redo(None);
        assert!(gc.has_undo());
        assert!(!gc.has_redo());
    }

    #[test]
    fn test_transactions_updated_bounds_in_transaction() {
        let mut gc = GridController::test();
        let (operation, _) = get_operations(&mut gc);
        assert_eq!(gc.grid().sheets()[0].bounds(true), GridBounds::Empty);

        let mut transaction = PendingTransaction {
            source: TransactionSource::User,
            operations: vec![operation.clone()].into(),
            ..Default::default()
        };
        gc.start_transaction(&mut transaction);
        gc.finalize_transaction(transaction);

        let expected = GridBounds::NonEmpty(Rect::single_pos((0, 0).into()));
        assert_eq!(gc.grid().sheets()[0].bounds(true), expected);
    }

    #[test]
    fn test_transactions_cell_hash() {
        let hash = "test".to_string();
        let cell_hash = CellHash(hash.clone());
        assert_eq!(cell_hash.get(), hash);

        let pos = Pos::from((0, 0));
        let cell_hash = CellHash::from(pos);
        assert_eq!(cell_hash, CellHash("0,0".into()));
    }

    #[test]
    fn test_js_calculation_complete() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Python,
            "1 + 1".into(),
            None,
        );

        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("1".into(), 2)),
            ..Default::default()
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_connection_complete() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Connection {
                kind: ConnectionKind::Postgres,
                id: Uuid::new_v4().to_string(),
            },
            "select * from table".into(),
            None,
        );

        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc.connection_complete(
            transaction_id.to_string(),
            vec![],
            None,
            Some("error".into()),
            None,
        );

        assert!(result.is_ok());
    }
}
