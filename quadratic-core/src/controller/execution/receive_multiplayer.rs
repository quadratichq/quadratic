use std::collections::VecDeque;

use chrono::{Duration, TimeDelta, Utc};
use uuid::Uuid;

use super::TransactionSource;
use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::active_transactions::unsaved_transactions::UnsavedTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::transaction::{Transaction, TransactionServer};

// seconds to wait before requesting wait_for_transactions
const SECONDS_TO_WAIT_FOR_GET_TRANSACTIONS: i64 = 5;

impl GridController {
    /// Rolls back unsaved transactions to apply earlier transactions received from the server.
    fn rollback_unsaved_transactions(&mut self) {
        if self.transactions.unsaved_transactions.is_empty() {
            return;
        }
        let operations = self
            .transactions
            .unsaved_transactions
            .iter()
            .rev()
            .flat_map(|unsaved_transaction| unsaved_transaction.reverse.operations.clone())
            .collect::<VecDeque<_>>();
        let mut rollback = PendingTransaction {
            source: TransactionSource::Multiplayer,
            operations,
            ..Default::default()
        };
        self.start_transaction(&mut rollback);
        self.finalize_transaction(rollback);
    }

    /// Reapplies the rolled-back unsaved transactions after adding earlier transactions.
    fn reapply_unsaved_transactions(&mut self) {
        if self.transactions.unsaved_transactions.is_empty() {
            return;
        }
        let operations = self
            .transactions
            .unsaved_transactions
            .iter()
            .rev()
            .flat_map(|unsaved_transaction| unsaved_transaction.forward.operations.clone())
            .collect::<Vec<_>>();
        let mut reapply = PendingTransaction {
            // Note: setting this to multiplayer makes it so the calculations are not rerun when reapplied.
            // This seems the right approach, otherwise we may end up with long running calculations
            // having to be sent to the server multiple times when multiple users are making changes.
            source: TransactionSource::Multiplayer,
            operations: operations.into(),
            ..Default::default()
        };
        self.start_transaction(&mut reapply);
        self.finalize_transaction(reapply);
    }

    /// Used by the server to apply transactions. Since the server owns the sequence_num,
    /// there's no need to check or alter the execution order.
    pub fn server_apply_transaction(
        &mut self,
        operations: Vec<Operation>,
        transaction_name: Option<TransactionName>,
    ) {
        let mut transaction = PendingTransaction {
            source: TransactionSource::Server,
            operations: operations.into(),
            transaction_name: transaction_name.unwrap_or(TransactionName::Unknown),
            ..Default::default()
        };
        self.start_transaction(&mut transaction);
        self.finalize_transaction(transaction);
    }

    /// Server sends us the latest sequence_num to ensure we're in sync. We respond with a request if
    /// we've been missing numbers for too long.
    pub fn receive_sequence_num(&mut self, sequence_num: u64) {
        if sequence_num != self.transactions.last_sequence_num {
            let now = Utc::now();
            if match self.transactions.last_get_transactions_time {
                None => true,
                Some(last_request_transaction_time) => {
                    let seconds = Duration::try_seconds(SECONDS_TO_WAIT_FOR_GET_TRANSACTIONS)
                        .unwrap_or(TimeDelta::zero());
                    last_request_transaction_time
                        .checked_add_signed(seconds)
                        .unwrap_or(now)
                        < now
                }
            } {
                self.transactions.last_get_transactions_time = None;

                if cfg!(target_family = "wasm") {
                    crate::wasm_bindings::js::jsRequestTransactions(
                        self.transactions.last_sequence_num + 1,
                    );
                }
            }
        } else if cfg!(target_family = "wasm") || cfg!(test) {
            crate::wasm_bindings::js::jsMultiplayerSynced();
        }
    }

    /// Check the out_of_order_transactions to see if they are next in order. If so, we remove them from
    /// out_of_order_transactions and apply their operations.
    fn apply_out_of_order_transactions(&mut self, mut sequence_num: u64) {
        // nothing to do here
        if self.transactions.out_of_order_transactions.is_empty() {
            self.transactions.last_sequence_num = sequence_num;
            return;
        }

        // combines all out of order transactions into a single vec of operations
        let mut operations = VecDeque::new();
        self.transactions.out_of_order_transactions.retain(|t| {
            // while the out of order transaction is next in sequence, we apply it and remove it from the list
            if let Some(transaction_sequence_num) = t.sequence_num {
                if transaction_sequence_num == sequence_num + 1 {
                    operations.extend(t.operations.clone());
                    sequence_num += 1;
                    false
                } else {
                    true
                }
            } else {
                // this should not happen as sequence_num for multiplayer transactions should always be set
                true
            }
        });
        let mut out_of_order_transaction = PendingTransaction {
            source: TransactionSource::Multiplayer,
            operations,
            ..Default::default()
        };
        self.start_transaction(&mut out_of_order_transaction);
        self.finalize_transaction(out_of_order_transaction);
        self.transactions.last_sequence_num = sequence_num;
    }

    /// Used by the client to ensure transactions are applied in order
    fn client_apply_transaction(&mut self, mut transaction: PendingTransaction, sequence_num: u64) {
        // this is the normal case where we receive the next transaction in sequence
        if sequence_num == self.transactions.last_sequence_num + 1 {
            // first check if the received transaction is one of ours
            if let Some(index) = self
                .transactions
                .unsaved_transactions
                .find_index(transaction.id)
            {
                // if it's our first unsaved_transaction, then there's nothing more to do except delete it and mark it as sent
                if index == 0 {
                    self.transactions.unsaved_transactions.remove(index);
                    self.mark_transaction_sent(transaction.id);
                    self.apply_out_of_order_transactions(sequence_num);
                }
                // otherwise we need to rollback all transaction and properly apply it
                else {
                    self.rollback_unsaved_transactions();

                    // use the operations from the unsaved_transaction queue as an optimization
                    let unsaved = self.transactions.unsaved_transactions.remove(index);
                    transaction.operations = unsaved.forward.operations.into();

                    self.mark_transaction_sent(transaction.id);
                    self.start_transaction(&mut transaction);
                    self.finalize_transaction(transaction);
                    self.apply_out_of_order_transactions(sequence_num);
                    self.reapply_unsaved_transactions();
                }
            } else {
                // If the transaction is not one of ours, then we just apply the transaction after rolling back any unsaved transactions
                self.rollback_unsaved_transactions();
                self.start_transaction(&mut transaction);
                self.finalize_transaction(transaction);
                self.apply_out_of_order_transactions(sequence_num);
                self.reapply_unsaved_transactions();
            }
        } else if sequence_num > self.transactions.last_sequence_num {
            // If we receive an unexpected later transaction then we just hold on to it in a sorted list.
            // We could apply these transactions as they come in, but only if multiplayer also sent all undo
            // operations w/each Transaction. I don't think this would be worth the cost.
            // We ignore any transactions that we already applied (ie, sequence_num <= self.last_sequence_num).
            let default_sequence_number = self.transactions.out_of_order_transactions.len();
            let index = self
                .transactions
                .out_of_order_transactions
                .iter()
                .position(|t| {
                    t.sequence_num.unwrap_or(default_sequence_number as u64) < sequence_num
                })
                .unwrap_or(default_sequence_number);
            self.transactions
                .out_of_order_transactions
                .insert(index, transaction.to_transaction(Some(sequence_num)));
        }
    }

    /// Received a transaction from the server
    pub fn received_transaction(
        &mut self,
        transaction_id: Uuid,
        sequence_num: u64,
        operations: Vec<Operation>,
    ) {
        let transaction = PendingTransaction {
            id: transaction_id,
            source: TransactionSource::Multiplayer,
            operations: operations.into(),
            ..Default::default()
        };
        self.client_apply_transaction(transaction, sequence_num);
    }

    /// Received transactions from the server
    pub fn received_transactions(&mut self, transactions: Vec<TransactionServer>) {
        self.rollback_unsaved_transactions();

        // combine all transaction into one transaction
        transactions.into_iter().for_each(|t| {
            let operations =
                Transaction::decompress_and_deserialize::<Vec<Operation>>(&t.operations);

            if let Ok(operations) = operations {
                self.received_transaction(t.id, t.sequence_num, operations);
            } else {
                dbgjs!(
                    "Unable to decompress and deserialize operations in received_transactions()"
                );
            }
        });

        self.reapply_unsaved_transactions();
    }

    /// Called by TS for each offline transaction it has in its offline queue.
    pub fn apply_offline_unsaved_transaction(
        &mut self,
        transaction_id: Uuid,
        unsaved_transaction: UnsavedTransaction,
    ) {
        // first check if we've already applied this transaction
        if let Some(transaction) = self.transactions.unsaved_transactions.find(transaction_id) {
            // send it to the server if we've not successfully sent it to the server
            if cfg!(target_family = "wasm") && !transaction.sent_to_server {
                let compressed_ops =
                    Transaction::serialize_and_compress(&unsaved_transaction.forward.operations);

                if let Ok(compressed_ops) = compressed_ops {
                    crate::wasm_bindings::js::jsSendTransaction(
                        transaction_id.to_string(),
                        compressed_ops,
                    );
                } else {
                    dbgjs!(
                        "Unable to serialize and compress operations in apply_offline_unsaved_transaction()"
                    );
                }
            }
        } else {
            let mut transaction = PendingTransaction {
                id: transaction_id,
                source: TransactionSource::Unsaved,
                ..Default::default()
            };
            transaction
                .operations
                .extend(unsaved_transaction.forward.operations.clone());

            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;
    use crate::controller::GridController;
    use crate::controller::transaction::Transaction;
    use crate::controller::transaction_types::{JsCellValueResult, JsCodeResult};
    use crate::grid::{CodeCellLanguage, Sheet};
    use crate::test_util::*;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call};
    use crate::{CellValue, Pos, SheetPos};

    #[test]
    fn test_multiplayer_hello_world() {
        let mut gc1 = GridController::test();
        let sheet_id = gc1.sheet_ids()[0];
        gc1.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World".to_string(),
            None,
            false,
        );
        let sheet = gc1.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );

        let transaction = gc1.last_transaction().unwrap();
        let transaction_id = transaction.id;
        let operations: Vec<Operation> = transaction.operations.clone();

        // received our own transaction back
        gc1.received_transaction(transaction_id, 1, operations.clone());

        let sheet = gc1.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );
        assert_eq!(gc1.transactions.unsaved_transactions.len(), 0);

        let mut gc2 = GridController::test();
        gc2.set_first_sheet_id(sheet_id);
        gc2.received_transaction(transaction_id, 1, operations);
        let sheet = gc2.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );
    }

    #[test]
    fn test_apply_multiplayer_before_unsaved_transaction() {
        let mut gc1 = GridController::test();
        let sheet_id = gc1.sheet_ids()[0];
        gc1.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World from 1".to_string(),
            None,
            false,
        );
        let sheet = gc1.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World from 1".to_string()))
        );

        let mut gc2 = GridController::test();
        // set gc2's Sheet1's id to gc1 Sheet1's id
        gc2.grid.try_sheet_mut(gc2.sheet_ids()[0]).unwrap().id = sheet_id;
        gc2.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World from 2".to_string(),
            None,
            false,
        );
        let sheet = gc2.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World from 2".to_string()))
        );

        let transaction = gc2.last_transaction().unwrap();
        let transaction_id = transaction.id;
        let operations = transaction.operations.clone();

        // gc1 should apply gc2's cell value to 0,0 before its unsaved transaction
        // and then reapply its unsaved transaction, overwriting 0,0
        gc1.received_transaction(transaction_id, 1, operations);
        let sheet = gc1.grid.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World from 1".to_string()))
        );
    }

    #[test]
    fn test_server_apply_transaction() {
        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];
        client.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World".to_string(),
            None,
            false,
        );
        let sheet = client.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );

        let transaction = client.last_transaction().unwrap();
        let operations = transaction.operations.clone();

        let mut server = GridController::test();
        server.grid.try_sheet_mut(server.sheet_ids()[0]).unwrap().id = sheet_id;
        server.server_apply_transaction(operations, None);
        let sheet = server.grid.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );
    }

    #[test]
    fn test_handle_receipt_of_earlier_transactions() {
        // client is where the multiplayer transactions are applied from other
        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];
        client.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Client unsaved value".to_string(),
            None,
            false,
        );

        // todo...
        // let transaction = client.last_transaction().unwrap();
        // assert!(transaction.generate_thumbnail);

        // other is where the transaction are created
        let mut other = GridController::test();
        other.set_first_sheet_id(sheet_id);
        other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Other value".to_string(),
            None,
            false,
        );

        let transaction = other.last_transaction().unwrap();
        let other_operations = transaction.operations.clone();

        client.received_transaction(Uuid::new_v4(), 1, other_operations);

        // todo: we should generate the thumbnail as we overwrite the unsaved value again
        // we should generate the thumbnail as we overwrite the unsaved value again
        // assert!(summary.generate_thumbnail);

        // we should still have our unsaved transaction
        assert_eq!(client.transactions.unsaved_transactions.len(), 1);

        // our unsaved value overwrites the older multiplayer value
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Client unsaved value".to_string()))
        );
    }

    #[test]
    fn test_handle_receipt_of_out_of_order_transactions() {
        // client is where the multiplayer transactions are applied from other
        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];

        // other is where the transaction are created
        let mut other = GridController::test();
        other.set_first_sheet_id(sheet_id);
        other.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "This is sequence_num = 1".to_string(),
            None,
            false,
        );
        let out_of_order_1_operations = other.last_transaction().unwrap().operations.clone();

        other.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "This is sequence_num = 2".to_string(),
            None,
            false,
        );
        let out_of_order_2_operations = other.last_transaction().unwrap().operations.clone();

        // Send sequence_num = 2 first to client. Client stores this transaction in out_of_order_transactions but does not apply it.
        client.received_transaction(Uuid::new_v4(), 2, out_of_order_2_operations);
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 1, y: 1 }),
            None
        );
        assert_eq!(client.transactions.out_of_order_transactions.len(), 1);

        // We receive the correctly ordered transaction. Both are applied in the correct order.
        client.received_transaction(Uuid::new_v4(), 1, out_of_order_1_operations);
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("This is sequence_num = 1".to_string()))
        );
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Text("This is sequence_num = 2".to_string()))
        );
        assert_eq!(client.transactions.out_of_order_transactions.len(), 0);
    }

    #[test]
    fn test_handle_receipt_of_earlier_transactions_and_out_of_order_transactions() {
        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];
        client.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Client unsaved value".to_string(),
            None,
            false,
        );
        let client_transaction = client.last_transaction().unwrap().clone();

        // other is where the transaction are created
        let mut other = GridController::test();
        other.set_first_sheet_id(sheet_id);
        other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "This is sequence_num = 1".to_string(),
            None,
            false,
        );
        let out_of_order_1_operations = other.last_transaction().unwrap().operations.clone();

        other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "This is sequence_num = 2".to_string(),
            None,
            false,
        );
        let out_of_order_2_operations = other.last_transaction().unwrap().operations.clone();

        // Send sequence_num = 2 first to client. Client stores this transaction in out_of_order_transactions but does not apply it.
        // We should still see our unsaved transaction.
        client.received_transaction(Uuid::new_v4(), 2, out_of_order_2_operations);
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Client unsaved value".to_string()))
        );
        assert_eq!(client.transactions.out_of_order_transactions.len(), 1);
        assert_eq!(client.transactions.unsaved_transactions.len(), 1);

        // We receive the correctly ordered transaction. Both are applied in the correct order.
        client.received_transaction(Uuid::new_v4(), 1, out_of_order_1_operations);
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Client unsaved value".to_string()))
        );
        assert_eq!(client.transactions.out_of_order_transactions.len(), 0);

        // We receive our unsaved transaction back.
        client.received_transaction(client_transaction.id, 3, client_transaction.operations);
        assert_eq!(client.transactions.unsaved_transactions.len(), 0);
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Client unsaved value".to_string()))
        );

        // We undo our old unsaved transaction and it will clear it (since we don't update our undo stack w/server changes).
        client.undo(1, None, false);
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            None
        );
    }

    #[test]
    fn test_send_request_transactions() {
        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];

        // other is where the transaction are created
        let mut other = GridController::test();
        other.set_first_sheet_id(sheet_id);
        other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "This is sequence_num = 1".to_string(),
            None,
            false,
        );
        let other_1_operations = other.last_transaction().unwrap().operations.clone();
        let other_1_operations_compressed =
            Transaction::serialize_and_compress(&other_1_operations).unwrap();

        other.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "This is sequence_num = 2".to_string(),
            None,
            false,
        );
        let other_2_operations = other.last_transaction().unwrap().operations.clone();
        let other_2_operations_compressed =
            Transaction::serialize_and_compress(&other_2_operations).unwrap();

        client.receive_sequence_num(2);

        clear_js_calls();

        // we send our last_sequence_num + 1 to the server so it can provide all later transactions
        assert_eq!(client.transactions.last_sequence_num, 0);

        // todo...
        // assert_eq!(client_summary.request_transactions, Some(1));

        client.received_transactions(vec![
            TransactionServer {
                file_id: Uuid::new_v4(),
                id: Uuid::new_v4(),
                sequence_num: 1,
                operations: other_1_operations_compressed,
            },
            TransactionServer {
                file_id: Uuid::new_v4(),
                id: Uuid::new_v4(),
                sequence_num: 2,
                operations: other_2_operations_compressed,
            },
        ]);
        assert_eq!(client.transactions.last_sequence_num, 2);

        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("This is sequence_num = 1".to_string()))
        );
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("This is sequence_num = 2".to_string()))
        );

        client.receive_sequence_num(2);

        expect_js_call("jsMultiplayerSynced", "".into(), true);
    }

    #[test]
    fn test_receive_multiplayer_while_waiting_for_async() {
        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];

        // other is where the transaction are created
        let mut other = GridController::test();
        other.set_first_sheet_id(sheet_id);
        other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "From other".to_string(),
            None,
            false,
        );
        let other_operations = other.last_transaction().unwrap().operations.clone();
        let other_operations_compressed =
            Transaction::serialize_and_compress(&other_operations).unwrap();

        client.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Python,
            "start this before receiving multiplayer".to_string(),
            None,
            None,
            false,
        );

        // ensure code_cell exists
        assert!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .code_run_at(&pos![A1])
                .is_some()
        );

        let transaction_id = client.async_transactions()[0].id;

        // we receive the first transaction while waiting for the async call to complete
        client.received_transactions(vec![TransactionServer {
            file_id: Uuid::new_v4(),
            id: Uuid::new_v4(),
            sequence_num: 1,
            operations: other_operations_compressed,
        }]);

        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("From other".to_string()))
        );

        // ensure code_cell still exists
        assert!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .code_run_at(&pos![A1])
                .is_some()
        );

        // mock the python calculation returning the result
        let result = client.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("async output".into(), 1)),
            ..Default::default()
        });
        assert!(result.is_ok());

        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("async output".to_string()))
        );
    }

    #[test]
    fn test_receive_overlapping_multiplayer_while_waiting_for_async() {
        // Unlike previous test, we receive a multiplayer transaction that will be underneath the async code_cell.
        // We expect the async code_cell to overwrite it when it completes.

        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];

        // other is where the transactions are created
        let mut other = GridController::test();
        other.set_first_sheet_id(sheet_id);
        other.set_cell_value(
            pos![A1].to_sheet_pos(sheet_id),
            "From other".to_string(),
            None,
            false,
        );
        let other_operations = other.last_transaction().unwrap().operations.clone();
        let other_operations_compressed =
            Transaction::serialize_and_compress(&other_operations).unwrap();

        client.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "start this before receiving multiplayer".to_string(),
            None,
            None,
            false,
        );

        // ensure code_cell exists
        assert_code_language(
            &client,
            pos![sheet_id!A1],
            CodeCellLanguage::Python,
            "start this before receiving multiplayer".to_string(),
        );

        let transaction_id = client.async_transactions()[0].id;

        // we receive the first transaction while waiting for the async call to complete
        client.received_transactions(vec![TransactionServer {
            file_id: Uuid::new_v4(),
            id: Uuid::new_v4(),
            sequence_num: 1,
            operations: other_operations_compressed,
        }]);

        // expect this to be Blank since the async client.set_code_cell overwrites the other's multiplayer transaction
        assert_eq!(
            client.try_sheet(sheet_id).unwrap().display_value(pos![A1]),
            Some(CellValue::Blank)
        );

        // ensure code_cell still exists
        assert!(client.sheet(sheet_id).code_run_at(&pos![A1]).is_some());

        // mock the python calculation returning the result
        let result = client.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("async output".into(), 1)),
            ..Default::default()
        });
        assert!(result.is_ok());

        assert_eq!(
            client.sheet(sheet_id).display_value(pos![A1]),
            Some(CellValue::Text("async output".to_string()))
        );
    }

    // used for the following tests to create multiplayer transactions
    // extension of test_python_multiple_calculations in run_python.rs
    // Tests in column A, and y: 1 = "1", y: 2 = "q.cells("A1") + 1", y: 3 = "q.cells("A2") + 1"

    // creates A1 = "1"
    fn create_multiple_calculations_0(gc: &mut GridController) -> (Uuid, Vec<Operation>) {
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            pos![A1].to_sheet_pos(sheet_id),
            "1".to_string(),
            None,
            false,
        );
        let transaction = gc.last_transaction().unwrap();
        (transaction.id, transaction.operations.clone())
    }

    // creates B1 = "q.cells("A1") + 1"
    fn create_multiple_calculations_1(gc: &mut GridController) -> (Uuid, Vec<Operation>) {
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "q.cells(\"A1\") + 1".into(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        assert!(result.values.is_some());

        let result = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("2".into(), 2)),
            ..Default::default()
        });
        assert!(result.is_ok());

        let transaction = gc.last_transaction().unwrap();
        (transaction_id, transaction.operations.clone())
    }

    // creates C1 = "q.cells("B1") + 1"
    fn create_multiple_calculations_2(gc: &mut GridController) -> (Uuid, Vec<Operation>) {
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            pos![C1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "q.cells(\"B1\") + 1".into(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "B1".to_string());
        assert!(result.values.is_some());

        let result = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("3".into(), 2)),
            ..Default::default()
        });
        assert!(result.is_ok());

        let transaction = gc.last_transaction().unwrap();
        (transaction_id, transaction.operations.clone())
    }

    #[test]
    fn python_multiple_calculations_receive_back_afterwards() {
        let mut gc = GridController::test();
        let (transaction_id_0, operations_0) = create_multiple_calculations_0(&mut gc);
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 1);
        let (transaction_id_1, operations_1) = create_multiple_calculations_1(&mut gc);
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 2);
        let (transaction_id_2, operations_2) = create_multiple_calculations_2(&mut gc);
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 3);
        assert_eq!(gc.active_transactions().async_transactions.len(), 0);

        // receive back the transactions in order
        gc.received_transaction(transaction_id_0, 1, operations_0);
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 2);

        gc.received_transaction(transaction_id_1, 2, operations_1);
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 1);

        gc.received_transaction(transaction_id_2, 3, operations_2);
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 0);

        let sheet = gc.grid.first_sheet();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(pos![B1]),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(pos![C1]),
            Some(CellValue::Number(3.into()))
        );
    }

    #[test]
    fn test_multiplayer_python_multiple_calculations_receive_back_between() {
        let mut gc = GridController::test();
        let (transaction_id_0, operations_0) = create_multiple_calculations_0(&mut gc);
        gc.received_transaction(transaction_id_0, 1, operations_0);

        let (transaction_id_1, operations_1) = create_multiple_calculations_1(&mut gc);
        gc.received_transaction(transaction_id_1, 2, operations_1);

        let (transaction_id_2, operations_2) = create_multiple_calculations_2(&mut gc);
        gc.received_transaction(transaction_id_2, 3, operations_2);

        let sheet = gc.grid.first_sheet();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(pos![B1]),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(pos![C1]),
            Some(CellValue::Number(3.into()))
        );
    }

    #[test]
    fn test_receive_offline_unsaved_transaction() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            "test".to_string(),
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id).cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );

        let unsaved_transaction = gc.active_transactions().unsaved_transactions[0].clone();

        let mut receive = GridController::test();
        receive.sheet_mut(receive.sheet_ids()[0]).id = sheet_id;

        receive
            .apply_offline_unsaved_transaction(unsaved_transaction.forward.id, unsaved_transaction);

        // todo...
        // assert!(summary.generate_thumbnail);
        assert_eq!(
            receive.sheet(sheet_id).cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );
    }

    #[test]
    fn test_acked_transaction() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            "test".to_string(),
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id).cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );

        // there is one unsaved transaction
        let unsaved_transactions = gc.active_transactions().unsaved_transactions.clone();
        assert_eq!(unsaved_transactions.len(), 1);

        // simulate an acked transaction that has no operations
        let ack_transaction = PendingTransaction {
            id: unsaved_transactions[0].forward.id,
            operations: VecDeque::new(),
            ..Default::default()
        };

        // apply the acked transaction
        gc.client_apply_transaction(ack_transaction, 1);

        // there are no unsaved transactions
        let unsaved_transactions = gc.active_transactions().unsaved_transactions.clone();
        assert_eq!(unsaved_transactions.len(), 0);

        assert_eq!(
            gc.sheet(sheet_id).cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );
    }

    #[test]
    fn ensure_code_run_ordering_is_maintained_for_undo() {
        // Note: 1x1 formulas are now stored as CellValue::Code, not DataTable.
        // To test DataTable ordering, we use multi-cell array formulas.
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        // Use array formulas (1x2) to ensure they remain as DataTables
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1;1}".to_string(), // 1x2 array
            None,
            None,
            false,
        );
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{2;2}".to_string(), // 1x2 array
            None,
            None,
            false,
        );
        gc.set_code_cell(
            SheetPos {
                x: 3,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{3;3}".to_string(), // 1x2 array
            None,
            None,
            false,
        );
        let find_index =
            |sheet: &Sheet, x: i64, y: i64| sheet.data_tables.get_index_of(&Pos { x, y }).unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 1, 1), 0);
        assert_eq!(find_index(sheet, 2, 1), 1);
        assert_eq!(find_index(sheet, 3, 1), 2);

        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            "".to_string(),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 1, 1), 0);
        assert_eq!(find_index(sheet, 3, 1), 1);

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 1, 1), 0);
        assert_eq!(find_index(sheet, 2, 1), 1);
        assert_eq!(find_index(sheet, 3, 1), 2);

        gc.redo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 1, 1), 0);
        assert_eq!(find_index(sheet, 3, 1), 1);

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 1, 1), 0);
        assert_eq!(find_index(sheet, 2, 1), 1);
        assert_eq!(find_index(sheet, 3, 1), 2);
    }

    #[test]
    fn receive_our_transactions_out_of_order() {
        let mut gc = GridController::test();
        let (transaction_id_0, operations_0) = create_multiple_calculations_0(&mut gc);
        let (transaction_id_1, operations_1) = create_multiple_calculations_1(&mut gc);
        let (transaction_id_2, operations_2) = create_multiple_calculations_2(&mut gc);

        gc.received_transaction(transaction_id_2, 3, operations_2);
        gc.received_transaction(transaction_id_0, 1, operations_0);
        gc.received_transaction(transaction_id_1, 2, operations_1);

        let cell_value_num = |n: i64| CellValue::Number(n.into());
        let sheet = gc.grid.first_sheet();

        assert_eq!(sheet.display_value(pos![A1]), Some(cell_value_num(1)));
        assert_eq!(sheet.display_value(pos![B1]), Some(cell_value_num(2)));
        assert_eq!(sheet.display_value(pos![C1]), Some(cell_value_num(3)));
    }
}
