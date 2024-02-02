use std::collections::VecDeque;

use super::TransactionType;
use crate::{
    controller::{
        active_transactions::{
            pending_transaction::PendingTransaction, unsaved_transactions::UnsavedTransaction,
        },
        operations::operation::Operation,
        transaction::TransactionServer,
        transaction_summary::TransactionSummary,
        GridController,
    },
    error_core::Result,
};
use chrono::{Duration, Utc};
use uuid::Uuid;

// seconds to wait before requesting wait_for_transactions
const SECONDS_TO_WAIT_FOR_GET_TRANSACTIONS: i64 = 5;

impl GridController {
    pub fn received_transaction(
        &mut self,
        transaction_id: Uuid,
        sequence_num: u64,
        operations: Vec<Operation>,
    ) -> TransactionSummary {
        let mut transaction = PendingTransaction {
            id: transaction_id,
            transaction_type: TransactionType::Multiplayer,
            operations: operations.into(),
            ..Default::default()
        };
        self.client_apply_transaction(&mut transaction, sequence_num);
        self.finalize_transaction(&mut transaction)
    }

    /// Rolls back unsaved transactions to apply earlier transactions received from the server.
    fn rollback_unsaved_transactions(&mut self, transaction: &mut PendingTransaction) {
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
            transaction_type: TransactionType::Multiplayer,
            operations,
            ..Default::default()
        };
        self.start_transaction(&mut rollback);

        // combine the results of these transactions with the current transaction
        transaction
            .sheets_with_dirty_bounds
            .extend(rollback.sheets_with_dirty_bounds.clone());
        let rollback_summary = rollback.prepare_summary(false);
        transaction.summary.merge(&rollback_summary);
    }

    /// Reapplies the rolled-back unsaved transactions after adding earlier transactions.
    fn reapply_unsaved_transactions(&mut self, transaction: &mut PendingTransaction) {
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
            transaction_type: TransactionType::Multiplayer,
            operations: operations.into(),
            ..Default::default()
        };
        self.start_transaction(&mut reapply);

        // combine the results of these transactions with the current transaction
        transaction
            .sheets_with_dirty_bounds
            .extend(reapply.sheets_with_dirty_bounds.clone());
        let reapply_summary = reapply.prepare_summary(false);
        transaction.summary.merge(&reapply_summary);
    }

    /// Used by the server to apply transactions. Since the server owns the sequence_num,
    /// there's no need to check or alter the execution order.
    pub fn server_apply_transaction(&mut self, operations: Vec<Operation>) {
        let mut transaction = PendingTransaction {
            transaction_type: TransactionType::Multiplayer,
            operations: operations.into(),
            ..Default::default()
        };
        self.start_transaction(&mut transaction);
    }

    /// Server sends us the latest sequence_num to ensure we're in sync. We respond with a request if
    /// we've been missing numbers for too long.
    ///
    /// Returns a [`TransactionSummary`] that will be rendered by the client.
    pub fn receive_sequence_num(&mut self, sequence_num: u64) -> TransactionSummary {
        let mut summary = TransactionSummary::default();
        if sequence_num != self.transactions.last_sequence_num {
            let now = Utc::now();
            if match self.transactions.last_get_transactions_time {
                None => true,
                Some(last_request_transaction_time) => {
                    last_request_transaction_time
                        .checked_add_signed(Duration::seconds(SECONDS_TO_WAIT_FOR_GET_TRANSACTIONS))
                        .unwrap_or(now)
                        < now
                }
            } {
                self.transactions.last_get_transactions_time = None;
                summary.request_transactions = Some(self.transactions.last_sequence_num + 1);
            }
        }
        summary
    }

    /// Check the out_of_order_transactions to see if they are next in order. If so, we remove them from
    /// out_of_order_transactions and apply their operations.
    fn apply_out_of_order_transactions(
        &mut self,
        transaction: &mut PendingTransaction,
        mut sequence_num: u64,
    ) {
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
            transaction_type: TransactionType::Multiplayer,
            operations,
            ..Default::default()
        };
        self.start_transaction(&mut out_of_order_transaction);

        // combine the results of these transactions with the current transaction
        transaction
            .sheets_with_dirty_bounds
            .extend(out_of_order_transaction.sheets_with_dirty_bounds.clone());
        transaction
            .summary
            .merge(&out_of_order_transaction.prepare_summary(false));

        self.transactions.last_sequence_num = sequence_num;
    }

    /// Used by the client to ensure transactions are applied in order
    ///
    /// Returns a [`TransactionSummary`] that will be rendered by the client.
    fn client_apply_transaction(
        &mut self,
        transaction: &mut PendingTransaction,
        sequence_num: u64,
    ) {
        // this is the normal case where we receive the next transaction in sequence
        if sequence_num == self.transactions.last_sequence_num + 1 {
            // first check if the received transaction is one of ours
            if let Some(index) = self
                .transactions
                .unsaved_transactions
                .find_index(transaction.id)
            {
                self.rollback_unsaved_transactions(transaction);
                self.transactions.unsaved_transactions.remove(index);
                self.mark_transaction_sent(transaction.id);
                self.start_transaction(transaction);
                self.apply_out_of_order_transactions(transaction, sequence_num);
                self.reapply_unsaved_transactions(transaction);
            } else {
                // If the transaction is not one of ours, then we just apply the transaction after rolling back any unsaved transactions
                self.rollback_unsaved_transactions(transaction);
                self.start_transaction(transaction);
                self.apply_out_of_order_transactions(transaction, sequence_num);
                self.reapply_unsaved_transactions(transaction);

                // We do not need to render a thumbnail unless we have outstanding unsaved transactions.
                // Note: this may result in a thumbnail being unnecessarily generated by a user who's
                // unsaved transactions did not force a thumbnail generation. This is a minor issue.
                if self.transactions.unsaved_transactions.is_empty() {
                    transaction.summary.generate_thumbnail = false;
                }
            }
        } else if sequence_num > self.transactions.last_sequence_num {
            // If we receive an unexpected later transaction then we just hold on to it in a sorted list.
            // We could apply these transactions as they come in, but only if multiplayer also sent all undo
            // operations w/each Transaction. I don't think this would be worth the cost.
            // We ignore any transactions that we already applied (ie, sequence_num <= self.last_sequence_num).
            let index = self
                .transactions
                .out_of_order_transactions
                .iter()
                .position(|t| t.sequence_num.unwrap() < sequence_num)
                .unwrap_or(self.transactions.out_of_order_transactions.len());
            self.transactions
                .out_of_order_transactions
                .insert(index, transaction.to_transaction(Some(sequence_num)));
        }
    }

    /// Received transactions from the server
    pub fn received_transactions(
        &mut self,
        transactions: &[TransactionServer],
    ) -> Result<TransactionSummary> {
        // used to track client changes when combining transactions
        let mut results = PendingTransaction {
            transaction_type: TransactionType::Multiplayer,
            ..Default::default()
        };
        self.rollback_unsaved_transactions(&mut results);

        // combine all transaction into one transaction
        transactions.iter().for_each(|t| {
            let mut transaction = PendingTransaction {
                id: t.id,
                transaction_type: TransactionType::Multiplayer,
                operations: t.operations.clone().into(),
                cursor: None,
                ..Default::default()
            };
            self.client_apply_transaction(&mut transaction, t.sequence_num);
            results.summary.merge(&transaction.summary);
            results
                .sheets_with_dirty_bounds
                .extend(transaction.sheets_with_dirty_bounds);
        });
        self.reapply_unsaved_transactions(&mut results);
        Ok(self.finalize_transaction(&mut results))
    }

    /// Called by TS for each offline transaction it has in its offline queue.
    ///
    /// Returns a [`TransactionSummary`] that will be rendered by the client.
    pub fn apply_offline_unsaved_transaction(
        &mut self,
        transaction_id: Uuid,
        unsaved_transaction: UnsavedTransaction,
    ) -> TransactionSummary {
        // first check if we've already applied this transaction
        if let Some(transaction) = self.transactions.unsaved_transactions.find(transaction_id) {
            // send it to the server if we've not successfully sent it to the server
            if !transaction.sent_to_server {
                if let Ok(operations) =
                    serde_json::to_string(&unsaved_transaction.forward.operations)
                {
                    if !cfg!(test) {
                        crate::wasm_bindings::js::sendTransaction(
                            transaction_id.to_string(),
                            operations,
                        );
                    }
                }
            }
            Default::default()
        } else {
            let transaction = &mut PendingTransaction {
                transaction_type: TransactionType::Multiplayer,
                ..Default::default()
            };
            transaction
                .operations
                .extend(unsaved_transaction.forward.operations.clone());

            // apply unsaved transaction
            self.rollback_unsaved_transactions(transaction);
            self.start_transaction(transaction);
            self.reapply_unsaved_transactions(transaction);

            self.transactions
                .unsaved_transactions
                .push(unsaved_transaction.clone());
            if let Ok(operations) = serde_json::to_string(&unsaved_transaction.forward.operations) {
                if !cfg!(test) {
                    crate::wasm_bindings::js::sendTransaction(
                        transaction_id.to_string(),
                        operations,
                    );
                }
            }
            transaction.prepare_summary(true)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::{
            transaction_types::{JsCodeResult, JsComputeGetCells},
            GridController,
        },
        grid::{CodeCellLanguage, Sheet},
        CellValue, CodeCellValue, Pos, Rect, SheetPos,
    };
    use bigdecimal::BigDecimal;
    use std::str::FromStr;
    use uuid::Uuid;

    #[test]
    fn test_multiplayer_hello_world() {
        let mut gc1 = GridController::test();
        let sheet_id = gc1.sheet_ids()[0];
        let summary = gc1.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World".to_string(),
            None,
        );
        let sheet = gc1.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );

        let transaction_id = Uuid::from_str(&summary.transaction_id.unwrap()).unwrap();
        let operations: Vec<Operation> =
            serde_json::from_str(&summary.operations.unwrap()).unwrap();

        // received our own transaction back
        gc1.received_transaction(transaction_id, 1, operations.clone());

        let sheet = gc1.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );
        assert_eq!(gc1.transactions.unsaved_transactions.len(), 0);

        let mut gc2 = GridController::test();
        gc2.grid_mut().sheets_mut()[0].id = sheet_id;
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
        );
        let sheet = gc1.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World from 1".to_string()))
        );

        let mut gc2 = GridController::test();
        // set gc2's sheet 1's id to gc1 sheet 1's id
        gc2.grid.try_sheet_mut(gc2.sheet_ids()[0]).unwrap().id = sheet_id;
        let summary = gc2.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World from 2".to_string(),
            None,
        );
        let sheet = gc2.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World from 2".to_string()))
        );

        let transaction_id = Uuid::from_str(&summary.transaction_id.unwrap()).unwrap();
        let operations = serde_json::from_str(&summary.operations.unwrap()).unwrap();

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
        let summary = client.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World".to_string(),
            None,
        );
        let sheet = client.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );
        let operations: Vec<Operation> =
            serde_json::from_str(&summary.operations.unwrap()).unwrap();

        let mut server = GridController::test();
        server.grid.try_sheet_mut(server.sheet_ids()[0]).unwrap().id = sheet_id;
        server.server_apply_transaction(operations);
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
        let summary = client.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Client unsaved value".to_string(),
            None,
        );
        assert!(summary.generate_thumbnail);

        // other is where the transaction are created
        let mut other = GridController::test();
        other.grid_mut().sheets_mut()[0].id = sheet_id;
        let other_summary = other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Other value".to_string(),
            None,
        );
        let other_operations: Vec<Operation> =
            serde_json::from_str(&other_summary.operations.unwrap()).unwrap();

        let summary = client.received_transaction(Uuid::new_v4(), 1, other_operations);

        // we should generate the thumbnail as we overwrite the unsaved value again
        assert!(summary.generate_thumbnail);

        // we should still have out unsaved transaction
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
        other.grid_mut().sheets_mut()[0].id = sheet_id;
        let out_of_order_1_summary = other.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "This is sequence_num = 1".to_string(),
            None,
        );
        let out_of_order_1_operations =
            serde_json::from_str(&out_of_order_1_summary.operations.unwrap()).unwrap();
        let out_of_order_2 = other.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "This is sequence_num = 2".to_string(),
            None,
        );
        let out_of_order_2_operations =
            serde_json::from_str(&out_of_order_2.operations.unwrap()).unwrap();

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
        let client_summary = client.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Client unsaved value".to_string(),
            None,
        );

        // other is where the transaction are created
        let mut other = GridController::test();
        other.grid_mut().sheets_mut()[0].id = sheet_id;
        let out_of_order_1_summary = other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "This is sequence_num = 1".to_string(),
            None,
        );
        let out_of_order_1_operations =
            serde_json::from_str(&out_of_order_1_summary.operations.unwrap()).unwrap();
        let out_of_order_2 = other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "This is sequence_num = 2".to_string(),
            None,
        );
        let out_of_order_2_operations =
            serde_json::from_str(&out_of_order_2.operations.unwrap()).unwrap();

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
        client.received_transaction(
            Uuid::from_str(&client_summary.transaction_id.unwrap()).unwrap(),
            3,
            serde_json::from_str(&client_summary.operations.unwrap()).unwrap(),
        );
        assert_eq!(client.transactions.unsaved_transactions.len(), 0);
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Client unsaved value".to_string()))
        );

        // We undo our old unsaved transaction and it will clear it (since we don't update our undo stack w/server changes).
        client.undo(None);
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
        other.grid_mut().sheets_mut()[0].id = sheet_id;
        let other_1 = other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "This is sequence_num = 1".to_string(),
            None,
        );
        let other_1_operations = serde_json::from_str(&other_1.operations.unwrap()).unwrap();
        let other_2 = other.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "This is sequence_num = 2".to_string(),
            None,
        );
        let other_2_operations = serde_json::from_str(&other_2.operations.unwrap()).unwrap();

        let client_summary = client.receive_sequence_num(2);

        // we send our last_sequence_num + 1 to the server so it can provide all later transactions
        assert_eq!(client.transactions.last_sequence_num, 0);
        assert_eq!(client_summary.request_transactions, Some(1));

        client
            .received_transactions(&[
                TransactionServer {
                    file_id: Uuid::new_v4(),
                    id: Uuid::new_v4(),
                    sequence_num: 1,
                    operations: other_1_operations,
                },
                TransactionServer {
                    file_id: Uuid::new_v4(),
                    id: Uuid::new_v4(),
                    sequence_num: 2,
                    operations: other_2_operations,
                },
            ])
            .ok();
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
    }

    #[test]
    fn test_receive_multiplayer_while_waiting_for_async() {
        let mut client = GridController::test();
        let sheet_id = client.sheet_ids()[0];

        // other is where the transaction are created
        let mut other = GridController::test();
        other.grid_mut().sheets_mut()[0].id = sheet_id;
        let other = other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "From other".to_string(),
            None,
        );
        let other_operations = serde_json::from_str(&other.operations.unwrap()).unwrap();

        client.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Python,
            "start this before receiving multiplayer".to_string(),
            None,
        );

        // ensure code_cell exists
        let code_cell = client
            .try_sheet(sheet_id)
            .unwrap()
            .cell_value(Pos { x: 1, y: 1 });
        assert!(matches!(code_cell, Some(CellValue::Code(_))));

        let transaction_id = client.async_transactions()[0].id;

        // we receive the first transaction while waiting for the async call to complete
        client
            .received_transactions(&[TransactionServer {
                file_id: Uuid::new_v4(),
                id: Uuid::new_v4(),
                sequence_num: 1,
                operations: other_operations,
            }])
            .ok();

        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("From other".to_string()))
        );

        // ensure code_cell still exists
        let code_cell = client
            .try_sheet(sheet_id)
            .unwrap()
            .cell_value(Pos { x: 1, y: 1 });
        assert!(matches!(code_cell, Some(CellValue::Code(_))));

        // mock the python calculation returning the result
        let result = client.calculation_complete(JsCodeResult::new_from_rust(
            transaction_id.to_string(),
            true,
            None,
            None,
            None,
            Some("async output".to_string()),
            None,
            None,
            None,
        ));
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
        other.grid_mut().sheets_mut()[0].id = sheet_id;
        let other = other.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "From other".to_string(),
            None,
        );
        let other_operations = serde_json::from_str(&other.operations.unwrap()).unwrap();

        client.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "start this before receiving multiplayer".to_string(),
            None,
        );

        // ensure code_cell exists
        let code_cell = client
            .try_sheet(sheet_id)
            .unwrap()
            .cell_value(Pos { x: 0, y: 0 });
        assert_eq!(
            code_cell,
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "start this before receiving multiplayer".to_string()
            }))
        );

        let transaction_id = client.async_transactions()[0].id;

        // we receive the first transaction while waiting for the async call to complete
        client
            .received_transactions(&[TransactionServer {
                file_id: Uuid::new_v4(),
                id: Uuid::new_v4(),
                sequence_num: 1,
                operations: other_operations,
            }])
            .ok();

        // expect this to be None since the async client.set_code_cell overwrites the other's multiplayer transaction
        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            None
        );

        // ensure code_cell still exists
        let code_cell = client
            .try_sheet(sheet_id)
            .unwrap()
            .cell_value(Pos { x: 0, y: 0 });
        assert!(matches!(code_cell, Some(CellValue::Code(_))));

        // mock the python calculation returning the result
        let result = client.calculation_complete(JsCodeResult::new_from_rust(
            transaction_id.to_string(),
            true,
            None,
            None,
            None,
            Some("async output".to_string()),
            None,
            None,
            None,
        ));
        assert!(result.is_ok());

        assert_eq!(
            client
                .try_sheet(sheet_id)
                .unwrap()
                .display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("async output".to_string()))
        );
    }

    // used for the following tests to create multiplayer transactions
    // extension of test_python_multiple_calculations in run_python.rs
    // Tests in column 0, and y: 0 = "1", y: 1 = "c(0,0) + 1", y: 2 = "c(0, 1) + 1"

    // creates 0,0 = "1"
    fn create_multiple_calculations_0(gc: &mut GridController) -> (String, String) {
        let sheet_id = gc.sheet_ids()[0];
        let summary = gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "1".to_string(),
            None,
        );
        (summary.transaction_id.unwrap(), summary.operations.unwrap())
    }

    // creates 0,1 = "c(0,0) + 1"
    fn create_multiple_calculations_1(gc: &mut GridController) -> (String, String) {
        let sheet_id = gc.sheet_ids()[0];
        let summary = gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "c(0, 0) + 1".into(),
            None,
        );
        let _ = gc
            .calculation_get_cells(JsComputeGetCells::new(
                summary.transaction_id.clone().unwrap(),
                Rect::from_numbers(0, 0, 1, 1),
                None,
                None,
            ))
            .ok()
            .unwrap();

        let result = gc.calculation_complete(JsCodeResult::new_from_rust(
            summary.transaction_id.unwrap(),
            true,
            None,
            None,
            None,
            Some("2".to_string()),
            None,
            None,
            None,
        ));
        let summary = result.ok().unwrap();
        (summary.transaction_id.unwrap(), summary.operations.unwrap())
    }

    // creates 0,2 = "c(0,1) + 1"
    fn create_multiple_calculations_2(gc: &mut GridController) -> (String, String) {
        let sheet_id = gc.sheet_ids()[0];
        let summary = gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "c(0, 1) + 1".into(),
            None,
        );
        let transaction_id = summary.transaction_id.clone().unwrap();
        let _ = gc
            .calculation_get_cells(JsComputeGetCells::new(
                transaction_id.clone(),
                Rect::from_numbers(0, 1, 1, 1),
                None,
                None,
            ))
            .ok()
            .unwrap();

        let result = gc.calculation_complete(JsCodeResult::new_from_rust(
            transaction_id,
            true,
            None,
            None,
            None,
            Some("3".to_string()),
            None,
            None,
            None,
        ));
        let summary = result.ok().unwrap();
        (summary.transaction_id.unwrap(), summary.operations.unwrap())
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
        gc.received_transaction(
            Uuid::from_str(&transaction_id_0).unwrap(),
            1,
            serde_json::from_str(&operations_0).unwrap(),
        );
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 2);

        gc.received_transaction(
            Uuid::from_str(&transaction_id_1).unwrap(),
            2,
            serde_json::from_str(&operations_1).unwrap(),
        );
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 1);

        gc.received_transaction(
            Uuid::from_str(&transaction_id_2).unwrap(),
            3,
            serde_json::from_str(&operations_2).unwrap(),
        );
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 0);

        let sheet = gc.grid.first_sheet();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
    }

    #[test]
    fn test_python_multiple_calculations_receive_back_between() {
        let mut gc = GridController::test();
        let (transaction_id_0, operations_0) = create_multiple_calculations_0(&mut gc);
        gc.received_transaction(
            Uuid::from_str(&transaction_id_0).unwrap(),
            1,
            serde_json::from_str(&operations_0).unwrap(),
        );

        let (transaction_id_1, operations_1) = create_multiple_calculations_1(&mut gc);
        gc.received_transaction(
            Uuid::from_str(&transaction_id_1).unwrap(),
            2,
            serde_json::from_str(&operations_1).unwrap(),
        );

        let (transaction_id_2, operations_2) = create_multiple_calculations_2(&mut gc);
        gc.received_transaction(
            Uuid::from_str(&transaction_id_2).unwrap(),
            3,
            serde_json::from_str(&operations_2).unwrap(),
        );

        let sheet = gc.grid.first_sheet();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(3)))
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
        );
        assert_eq!(
            gc.sheet(sheet_id).cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );

        let unsaved_transaction = gc.active_transactions().unsaved_transactions[0].clone();

        let mut receive = GridController::test();
        receive.sheet_mut(receive.sheet_ids()[0]).id = sheet_id;
        let summary = receive
            .apply_offline_unsaved_transaction(unsaved_transaction.forward.id, unsaved_transaction);
        assert!(summary.generate_thumbnail);
        assert_eq!(summary.cell_sheets_modified.len(), 1);
        assert_eq!(
            receive.sheet(sheet_id).cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );
    }

    #[test]
    fn ensure_code_run_ordering_is_maintained_for_undo() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1".to_string(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "2".to_string(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "3".to_string(),
            None,
        );
        let find_index = |sheet: &Sheet, x: i64, y: i64| {
            sheet
                .code_runs
                .iter()
                .position(|(code_pos, _)| *code_pos == Pos { x, y })
                .unwrap()
        };
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 0, 0), 0);
        assert_eq!(find_index(sheet, 1, 0), 1);
        assert_eq!(find_index(sheet, 2, 0), 2);

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 0, 0), 0);
        assert_eq!(find_index(sheet, 2, 0), 1);

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 0, 0), 0);
        assert_eq!(find_index(sheet, 1, 0), 1);
        assert_eq!(find_index(sheet, 2, 0), 2);

        gc.redo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 0, 0), 0);
        assert_eq!(find_index(sheet, 2, 0), 1);

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(find_index(sheet, 0, 0), 0);
        assert_eq!(find_index(sheet, 1, 0), 1);
        assert_eq!(find_index(sheet, 2, 0), 2);
    }
}
