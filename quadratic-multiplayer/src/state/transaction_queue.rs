use anyhow::{anyhow, Result};
use quadratic_core::controller::operation::Operation;
use std::collections::{HashMap, VecDeque};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, PartialEq)]
pub(crate) struct Transaction {
    pub(crate) id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) operations: Vec<Operation>,
    pub(crate) sequence: u64,
}

impl Transaction {
    pub(crate) fn new(id: Uuid, file_id: Uuid, operations: Vec<Operation>, sequence: u64) -> Self {
        Transaction {
            id,
            file_id,
            operations,
            sequence,
        }
    }
}

#[derive(Debug, Default)]
pub(crate) struct TransactionQueue {
    pub(crate) queue: VecDeque<Transaction>,
    pub(crate) file_sequence: Mutex<HashMap<Uuid, u64>>,
}

impl TransactionQueue {
    pub(crate) fn new() -> Self {
        Default::default()
    }

    pub(crate) async fn push(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
    ) -> u64 {
        let sequence = self.increment_sequence(file_id).await;
        let transaction = Transaction::new(id, file_id, operations, sequence);
        self.queue.push_back(transaction);
        sequence
    }

    pub(crate) fn pop(&mut self) -> Option<Transaction> {
        self.queue.pop_front()
    }

    /// Increment the sequence number for this file and return the new sequence number.
    pub(crate) async fn increment_sequence(&mut self, file_id: Uuid) -> u64 {
        self.file_sequence
            .lock()
            .await
            .entry(file_id)
            .and_modify(|sequence| *sequence += 1)
            .or_insert(1)
            .to_owned()
    }

    pub(crate) async fn get_sequence(&mut self, file_id: Uuid) -> Result<u64> {
        self.file_sequence
            .lock()
            .await
            .get(&file_id)
            .copied()
            .ok_or_else(|| anyhow!("file_id {file_id} not found in file_sequence"))
    }
}
#[cfg(test)]
mod tests {
    use quadratic_core::grid::{Sheet, SheetId};

    use crate::{
        state::State,
        test_util::{assert_anyhow_error, grid_setup, new_user, operation},
    };

    fn setup() -> (State, Uuid) {
        let state = State::new();
        let file_id = Uuid::new_v4();

        (state, file_id)
    }

    use super::*;
    #[tokio::test]
    async fn transaction_queue() {
        let (state, file_id) = setup();
        let mut grid = grid_setup();
        let transaction_id_1 = Uuid::new_v4();
        let operations_1 = operation(&mut grid, 0, 0, "1");
        let transaction_id_2 = Uuid::new_v4();
        let operations_2 = operation(&mut grid, 1, 0, "2");

        state
            .transaction_queue
            .lock()
            .await
            .push(transaction_id_1, file_id, vec![operations_1.clone()])
            .await;

        let mut transaction_queue = state.transaction_queue.lock().await;
        assert_eq!(transaction_queue.queue.len(), 1);
        assert_eq!(transaction_queue.get_sequence(file_id).await.unwrap(), 1);
        assert_eq!(
            transaction_queue.queue[0].operations,
            vec![operations_1.clone()]
        );
        assert_eq!(transaction_queue.queue[0].sequence, 1);

        std::mem::drop(transaction_queue);

        state
            .transaction_queue
            .lock()
            .await
            .push(transaction_id_2, file_id, vec![operations_2.clone()])
            .await;

        let mut transaction_queue = state.transaction_queue.lock().await;
        assert_eq!(transaction_queue.queue.len(), 2);
        assert_eq!(transaction_queue.get_sequence(file_id).await.unwrap(), 2);
        assert_eq!(transaction_queue.queue[0].operations, vec![operations_1]);
        assert_eq!(transaction_queue.queue[1].operations, vec![operations_2]);
        assert_eq!(transaction_queue.queue[0].sequence, 1);
        assert_eq!(transaction_queue.queue[1].sequence, 2);
    }
}
