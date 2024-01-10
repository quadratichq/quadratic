use quadratic_core::controller::{
    operations::operation::Operation, transaction::TransactionServer,
};
use quadratic_rust_shared::pubsub::{
    redis_streams::RedisConnection, Config as PubSubConfig, PubSub as PubSubTrait,
};
use serde::Serialize;
use std::collections::HashMap;
use uuid::Uuid;

use crate::error::{MpError, Result};

pub static GROUP_NAME: &str = "quadratic-multiplayer-1";

#[derive(Debug)]
pub(crate) struct PubSub {
    pub(crate) config: PubSubConfig,
    pub(crate) connection: RedisConnection,
}

impl PubSub {
    /// Create a new connection to the PubSub server
    pub(crate) async fn new(config: PubSubConfig) -> Result<Self> {
        let connection = RedisConnection::new(config.to_owned()).await?;
        Ok(PubSub { config, connection })
    }
}

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

pub(crate) type Queue = HashMap<Uuid, (u64, Vec<TransactionServer>)>;

#[derive(Debug)]
pub(crate) struct TransactionQueue {
    pending: Queue,
    processed: Queue,
    pub(crate) pubsub: PubSub,
}

impl TransactionQueue {
    pub(crate) async fn new(pubsub_config: PubSubConfig) -> Self {
        TransactionQueue {
            pending: HashMap::new(),
            processed: HashMap::new(),
            pubsub: PubSub::new(pubsub_config).await.unwrap(),
        }
    }

    async fn push(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
        sequence_num: u64,
    ) -> u64 {
        let transaction = TransactionServer {
            id,
            file_id,
            operations,
            sequence_num,
        };

        let transaction = serde_json::to_string(&transaction).unwrap();

        self.pubsub
            .connection
            .publish(
                &file_id.to_string(),
                &sequence_num.to_string(),
                &transaction,
                self.config.active_channels,
            )
            .await
            .unwrap();

        sequence_num
    }

    pub(crate) async fn push_pending(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
        room_sequence_num: u64,
    ) -> u64 {
        self.push(id, file_id, operations, room_sequence_num).await
    }

    pub(crate) async fn push_processed(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
        room_sequence_num: u64,
    ) -> u64 {
        self.push(id, file_id, operations, room_sequence_num).await
    }

    // pub(crate) fn get_pending(&mut self, file_id: Uuid) -> Result<Vec<TransactionServer>> {
    //     let transactions = self
    //         .pending
    //         .get(&file_id)
    //         .ok_or_else(|| {
    //             MpError::TransactionQueue(format!(
    //                 "file_id {file_id} not found in transaction queue"
    //             ))
    //         })?
    //         .1
    //         .to_owned();

    //     Ok(transactions)
    // }

    // pub(crate) async fn complete_transactions(
    //     &mut self,
    //     file_id: Uuid,
    //     sequence_numbers: Vec<u64>,
    // ) -> Result<(u64, Vec<TransactionServer>)> {
    //     // first, add transactions to the processed queue
    //     self.shovel_pending(file_id).await?;

    //     // next, remove transactions from the pending queue
    //     self.drain_pending(file_id)
    // }

    // /// Move transactions from the pending queue to the processed queue for a given file
    // pub(crate) async fn shovel_pending(&mut self, file_id: Uuid) -> Result<Vec<TransactionServer>> {
    //     let transactions = self
    //         .get_pending(file_id)?
    //         .into_iter()
    //         .map(|transaction| {
    //             async {
    //                 self.push_processed(
    //                     transaction.id,
    //                     transaction.file_id,
    //                     transaction.operations.to_owned(),
    //                     transaction.sequence_num,
    //                 )
    //                 .await;
    //             };

    //             transaction
    //         })
    //         .collect::<Vec<TransactionServer>>();

    //     Ok(transactions)
    // }

    /// Drain the pending queue
    ///
    /// TODO(ddimaria): if remove transactions is atomic (locked mutex),
    /// then this error condition should never happen, but figure out
    /// what to do in the case that id does.
    pub(crate) fn drain_pending(&mut self, file_id: Uuid) -> Result<(u64, Vec<TransactionServer>)> {
        self.pending.remove(&file_id).ok_or_else(|| {
            MpError::TransactionQueue(format!(
                "Could not remove pending transactions for file_id {file_id}"
            ))
        })
    }

    // pub(crate) fn get_pending_min_sequence_num(
    //     &mut self,
    //     file_id: Uuid,
    //     min_sequence_num: u64,
    // ) -> Result<Vec<TransactionServer>> {
    //     let transactions = self
    //         .get_pending(file_id)?
    //         .into_iter()
    //         .filter(|transaction| transaction.sequence_num >= min_sequence_num)
    //         .collect();

    //     Ok(transactions)
    // }

    /// Returns latest sequence number for a given file (if any are in the transaction_queue)
    pub(crate) fn get_sequence_num(&mut self, file_id: Uuid) -> Option<u64> {
        self.pending.get(&file_id).map(|o| o.0)
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

        state
            .transaction_queue
            .lock()
            .await
            .pubsub
            .connection
            .subscribe(&file_id.to_string(), GROUP_NAME)
            .await
            .unwrap();

        (state, file_id)
    }

    use super::*;
    #[tokio::test]
    async fn add_operations_to_the_transaction_queue() {
        let (state, file_id) = setup().await;
        let mut grid = grid_setup();
        let transaction_id_1 = Uuid::new_v4();
        let operations_1 = operation(&mut grid, 0, 0, "1");
        let transaction_id_2 = Uuid::new_v4();
        let operations_2 = operation(&mut grid, 1, 0, "2");

        state
            .transaction_queue
            .lock()
            .await
            .push_pending(transaction_id_1, file_id, vec![operations_1.clone()], 1)
            .await;

        // let mut transaction_queue = state.transaction_queue.lock().await;
        // let transactions = transaction_queue.get_pending(file_id).unwrap();
        // assert_eq!(transactions.len(), 1);
        // assert_eq!(transaction_queue.get_sequence_num(file_id).unwrap(), 1);
        // assert_eq!(transactions[0].operations, vec![operations_1.clone()]);
        // assert_eq!(transactions[0].sequence_num, 1);

        // std::mem::drop(transaction_queue);

        // state
        //     .transaction_queue
        //     .lock()
        //     .await
        //     .push_pending(transaction_id_2, file_id, vec![operations_2.clone()], 0)
        //     .await;

        // let mut transaction_queue = state.transaction_queue.lock().await;
        // let transactions = transaction_queue.get_pending(file_id).unwrap();
        // assert_eq!(transactions.len(), 2);
        // assert_eq!(transaction_queue.get_sequence_num(file_id).unwrap(), 2);
        // assert_eq!(transactions[0].operations, vec![operations_1.clone()]);
        // assert_eq!(transactions[0].sequence_num, 1);
        // assert_eq!(transactions[1].operations, vec![operations_2.clone()]);
        // assert_eq!(transactions[1].sequence_num, 2);
    }
}
