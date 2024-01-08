use quadratic_core::controller::{
    operations::operation::Operation, transaction::TransactionServer,
};
use quadratic_rust_shared::pubsub::{
    redis_streams::RedisConnection, Config as PubSubConfig, PubSub as PubSubTrait,
};
use serde::Serialize;
use std::collections::HashMap;
use uuid::Uuid;

use crate::error::{FilesError, Result};

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
    }
}
