use anyhow::{anyhow, Result};
use quadratic_core::controller::operation::Operation;
use serde::Serialize;
use std::collections::HashMap;
use uuid::Uuid;

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

#[derive(Debug, Default)]
pub(crate) struct TransactionQueue {
    pub(crate) queue: HashMap<Uuid, (u64, Vec<Transaction>)>,
}

impl TransactionQueue {
    pub(crate) fn new() -> Self {
        Default::default()
    }

    pub(crate) fn push(&mut self, id: Uuid, file_id: Uuid, operations: Vec<Operation>) -> u64 {
        let (sequence_num, transactions) = self.queue.entry(file_id).or_insert_with(|| (0, vec![]));

        *sequence_num += 1;

        let transaction = Transaction::new(id, file_id, operations, *sequence_num);
        transactions.push(transaction);

        sequence_num.to_owned()
    }

    pub(crate) fn get_transactions(&mut self, file_id: Uuid) -> Result<Vec<Transaction>> {
        let transactions = self
            .queue
            .get(&file_id)
            .ok_or_else(|| anyhow!("file_id {file_id} not found in transaction queue"))?
            .1
            .to_owned();

        Ok(transactions)
    }

    pub(crate) fn get_transactions_min_sequence_num(
        &mut self,
        file_id: Uuid,
        min_sequence_num: u64,
    ) -> Result<Vec<Transaction>> {
        let transactions = self
            .get_transactions(file_id)?
            .into_iter()
            .filter(|transaction| transaction.sequence_num >= min_sequence_num)
            .collect();

        Ok(transactions)
    }

    pub(crate) fn get_sequence_num(&mut self, file_id: Uuid) -> Result<u64> {
        let sequence_num = self
            .queue
            .get(&file_id)
            .ok_or_else(|| anyhow!("file_id {file_id} not found in transaction queue"))?
            .0;

        Ok(sequence_num)
    }
}
#[cfg(test)]
mod tests {
    use crate::{
        state::State,
        test_util::{grid_setup, operation},
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

        state.transaction_queue.lock().await.push(
            transaction_id_1,
            file_id,
            vec![operations_1.clone()],
        );

        let mut transaction_queue = state.transaction_queue.lock().await;
        let transactions = transaction_queue.get_transactions(file_id).unwrap();
        assert_eq!(transactions.len(), 1);
        assert_eq!(transaction_queue.get_sequence_num(file_id).unwrap(), 1);
        assert_eq!(transactions[0].operations, vec![operations_1.clone()]);
        assert_eq!(transactions[0].sequence_num, 1);

        std::mem::drop(transaction_queue);

        state.transaction_queue.lock().await.push(
            transaction_id_2,
            file_id,
            vec![operations_2.clone()],
        );

        let mut transaction_queue = state.transaction_queue.lock().await;
        let transactions = transaction_queue.get_transactions(file_id).unwrap();
        assert_eq!(transactions.len(), 2);
        assert_eq!(transaction_queue.get_sequence_num(file_id).unwrap(), 2);
        assert_eq!(transactions[0].operations, vec![operations_1.clone()]);
        assert_eq!(transactions[0].sequence_num, 1);
        assert_eq!(transactions[1].operations, vec![operations_2.clone()]);
        assert_eq!(transactions[1].sequence_num, 2);
    }
}
