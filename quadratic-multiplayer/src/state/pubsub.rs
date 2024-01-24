use quadratic_core::controller::{
    operations::operation::Operation, transaction::TransactionServer,
};
use quadratic_rust_shared::pubsub::{
    redis_streams::RedisConnection, Config as PubSubConfig, PubSub as PubSubTrait,
};
use uuid::Uuid;

use crate::error::Result;

pub static GROUP_NAME: &str = "quadratic-multiplayer-1";

#[derive(Debug)]
pub(crate) struct PubSub {
    pub(crate) config: PubSubConfig,
    pub(crate) connection: RedisConnection,
}

impl PubSub {
    /// Create a new connection to the PubSub server
    pub(crate) async fn new(config: PubSubConfig) -> Result<Self> {
        let connection = Self::connect(&config).await?;

        Ok(PubSub { config, connection })
    }

    /// Connect to the PubSub server
    pub(crate) async fn connect(config: &PubSubConfig) -> Result<RedisConnection> {
        let connection = RedisConnection::new(config.to_owned()).await?;

        Ok(connection)
    }

    pub(crate) async fn push(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<Operation>,
        sequence_num: u64,
    ) -> Result<u64> {
        let transaction = TransactionServer {
            id,
            file_id,
            operations,
            sequence_num,
        };

        let transaction = serde_json::to_string(&transaction)?;
        let active_channels = match self.config {
            PubSubConfig::RedisStreams(ref config) => config.active_channels.as_str(),
            _ => "active_channels",
        };

        self.connection
            .publish(
                &file_id.to_string(),
                &sequence_num.to_string(),
                &transaction,
                Some(active_channels),
            )
            .await?;

        Ok(sequence_num)
    }

    /// Check if the connection is healthy and attempt to reconnect if not
    pub(crate) async fn reconnect_if_unhealthy(&mut self) {
        let is_healthy = self.connection.is_healthy().await;

        if !is_healthy {
            tracing::error!("PubSub connection is unhealthy");

            match Self::connect(&self.config).await {
                Ok(connection) => {
                    self.connection = connection;
                    tracing::info!("PubSub connection is now healthy");
                }
                Err(error) => {
                    tracing::error!("Error reconnecting to PubSub {error}");
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use quadratic_core::controller::GridController;

    use crate::{
        state::State,
        test_util::{new_state, operation},
    };

    async fn setup() -> (State, Uuid) {
        let state = new_state().await;
        let file_id = Uuid::new_v4();

        state
            .pubsub
            .lock()
            .await
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
        let mut grid = GridController::test();
        let transaction_id_1 = Uuid::new_v4();
        let operations_1 = operation(&mut grid, 0, 0, "1");
        let _transaction_id_2 = Uuid::new_v4();
        let _operations_2 = operation(&mut grid, 1, 0, "2");

        state
            .pubsub
            .lock()
            .await
            .push(transaction_id_1, file_id, vec![operations_1.clone()], 1)
            .await
            .unwrap();

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
