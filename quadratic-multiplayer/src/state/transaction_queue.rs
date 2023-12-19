use quadratic_core::controller::operations::operation::Operation;
use serde::Serialize;
use std::collections::HashMap;
use uuid::Uuid;

use crate::error::{MpError, Result};

#[derive(Serialize, Debug, PartialEq, Clone)]
pub(crate) struct Transaction {
    pub(crate) id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) operations: Vec<Operation>,
    pub(crate) sequence_num: u64,
}

impl Transaction {
    pub(crate) fn new(
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
        sequence_num: u64,
    ) -> Self {
        Transaction {
            id,
            file_id,
            operations,
            sequence_num,
        }
    }
}

pub(crate) type Queue = HashMap<Uuid, (u64, Vec<Transaction>)>;

#[derive(Debug, Default)]
pub(crate) struct TransactionQueue {
    pending: Queue,
    processed: Queue,
}

impl TransactionQueue {
    pub(crate) fn new() -> Self {
        Default::default()
    }

    fn push(queue: &mut Queue, id: Uuid, file_id: Uuid, operations: Vec<Operation>) -> u64 {
        let (sequence_num, transactions) = queue.entry(file_id).or_insert_with(|| (0, vec![]));

        *sequence_num += 1;

        let transaction = Transaction::new(id, file_id, operations, *sequence_num);
        transactions.push(transaction);

        sequence_num.to_owned()
    }

    pub(crate) fn push_pending(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
    ) -> u64 {
        TransactionQueue::push(&mut self.pending, id, file_id, operations)
    }

    pub(crate) fn push_processed(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
    ) -> u64 {
        TransactionQueue::push(&mut self.processed, id, file_id, operations)
    }

    pub(crate) fn get_pending(&mut self, file_id: Uuid) -> Result<Vec<Transaction>> {
        let transactions = self
            .pending
            .get(&file_id)
            .ok_or_else(|| {
                MpError::TransactionQueue(format!(
                    "file_id {file_id} not found in transaction queue"
                ))
            })?
            .1
            .to_owned();

        Ok(transactions)
    }

    pub(crate) fn complete_transactions(
        &mut self,
        file_id: Uuid,
    ) -> Result<(u64, Vec<Transaction>)> {
        // first, add transactions to the processed queue
        self.shovel_pending(file_id)?;

        // next, remove transactions from the pending queue
        self.drain_pending(file_id)
    }

    /// Move transactions from the pending queue to the processed queue for a given file
    pub(crate) fn shovel_pending(&mut self, file_id: Uuid) -> Result<Vec<Transaction>> {
        let transactions = self
            .get_pending(file_id)?
            .into_iter()
            .map(|transaction| {
                self.push_processed(
                    transaction.id,
                    transaction.file_id,
                    transaction.operations.to_owned(),
                );

                transaction
            })
            .collect::<Vec<_>>();

        Ok(transactions)
    }

    /// Drain the pending queue
    ///
    /// TODO(ddimaria): if remove transactions is atomic (locked mutex),
    /// then this error condition should never happen, but figure out
    /// what to do in the case that id does.
    pub(crate) fn drain_pending(&mut self, file_id: Uuid) -> Result<(u64, Vec<Transaction>)> {
        self.pending.remove(&file_id).ok_or_else(|| {
            MpError::TransactionQueue(format!(
                "Could not remove pending transactions for file_id {file_id}"
            ))
        })
    }

    pub(crate) fn get_pending_min_sequence_num(
        &mut self,
        file_id: Uuid,
        min_sequence_num: u64,
    ) -> Result<Vec<Transaction>> {
        let transactions = self
            .get_pending(file_id)?
            .into_iter()
            .filter(|transaction| transaction.sequence_num >= min_sequence_num)
            .collect();

        Ok(transactions)
    }

    pub(crate) fn get_sequence_num(&mut self, file_id: Uuid) -> Result<u64> {
        let sequence_num = self
            .pending
            .get(&file_id)
            .ok_or_else(|| {
                MpError::TransactionQueue(format!(
                    "file_id {file_id} not found in transaction queue"
                ))
            })?
            .0;

        Ok(sequence_num)
    }
}
#[cfg(test)]
mod tests {
    use crate::{
        state::State,
        test_util::{grid_setup, new_state, operation},
    };

    async fn setup() -> (State, Uuid) {
        let state = new_state().await;
        let file_id = Uuid::new_v4();

        (state, file_id)
    }

    use super::*;
    #[tokio::test]
    async fn transaction_queue() {
        let (state, file_id) = setup().await;
        let mut grid = grid_setup();
        let transaction_id_1 = Uuid::new_v4();
        let operations_1 = operation(&mut grid, 0, 0, "1");
        let transaction_id_2 = Uuid::new_v4();
        let operations_2 = operation(&mut grid, 1, 0, "2");

        state.transaction_queue.lock().await.push_pending(
            transaction_id_1,
            file_id,
            vec![operations_1.clone()],
        );

        let mut transaction_queue = state.transaction_queue.lock().await;
        let transactions = transaction_queue.get_pending(file_id).unwrap();
        assert_eq!(transactions.len(), 1);
        assert_eq!(transaction_queue.get_sequence_num(file_id).unwrap(), 1);
        assert_eq!(transactions[0].operations, vec![operations_1.clone()]);
        assert_eq!(transactions[0].sequence_num, 1);

        std::mem::drop(transaction_queue);

        state.transaction_queue.lock().await.push_pending(
            transaction_id_2,
            file_id,
            vec![operations_2.clone()],
        );

        let mut transaction_queue = state.transaction_queue.lock().await;
        let transactions = transaction_queue.get_pending(file_id).unwrap();
        assert_eq!(transactions.len(), 2);
        assert_eq!(transaction_queue.get_sequence_num(file_id).unwrap(), 2);
        assert_eq!(transactions[0].operations, vec![operations_1.clone()]);
        assert_eq!(transactions[0].sequence_num, 1);
        assert_eq!(transactions[1].operations, vec![operations_2.clone()]);
        assert_eq!(transactions[1].sequence_num, 2);
    }
}
