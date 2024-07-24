use quadratic_core::controller::{
    operations::operation::Operation, transaction::TransactionServer,
};
use quadratic_rust_shared::pubsub::{
    redis_streams::RedisConnection, Config as PubSubConfig, PubSub as PubSubTrait,
};
use uuid::Uuid;

use crate::error::Result;

use super::State;

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
        operations: Vec<u8>,
        sequence_num: u64,
    ) -> Result<u64> {
        let transaction = TransactionServer {
            id,
            file_id,
            operations,
            sequence_num,
        };

        let active_channels = match self.config {
            PubSubConfig::RedisStreams(ref config) => config.active_channels.as_str(),
            _ => "active_channels",
        };

        self.connection
            .publish(
                &file_id.to_string(),
                &sequence_num.to_string(),
                transaction,
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

impl State {
    /// Subscribe to the PubSub channel for a file
    pub(crate) async fn subscribe_pubsub(&self, file_id: &Uuid, group_name: &str) -> Result<()> {
        self.pubsub
            .lock()
            .await
            .connection
            .subscribe(&file_id.to_string(), group_name)
            .await?;

        Ok(())
    }

    /// Push a transaction to the transaction queue
    pub(crate) async fn push_pubsub(
        &self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<u8>,
        sequence_num: u64,
    ) -> Result<u64> {
        self.pubsub
            .lock()
            .await
            .push(id, file_id, operations, sequence_num)
            .await
    }

    pub(crate) async fn get_messages_from_pubsub(
        &self,
        file_id: &Uuid,
        min_sequence_num: u64,
    ) -> Result<Vec<u8>> {
        Ok(self
            .pubsub
            .lock()
            .await
            .connection
            .get_messages_from(&file_id.to_string(), &min_sequence_num.to_string(), false)
            .await?
            .iter()
            .flat_map(|(_, message)| message)
            .collect::<Vec<u8>>())
    }

    /// Get the last message from the PubSub channel
    /// Returns a tuple of (sequence number, last message)
    pub(crate) async fn get_last_message_pubsub(&self, file_id: &Uuid) -> Result<(String, String)> {
        Ok(self
            .pubsub
            .lock()
            .await
            .connection
            .last_message(&file_id.to_string(), false)
            .await?)
    }
}

#[cfg(test)]
mod tests {
    use quadratic_core::controller::GridController;

    use crate::test_util::{operation, setup};

    use super::*;
    #[tokio::test]
    async fn all_pubsub_functionality() {
        let (_, state, _, file_id, _, _) = setup().await;
        let mut grid = GridController::test();
        let transaction_id_1 = Uuid::new_v4();
        let operations_1 = operation(&mut grid, 0, 0, "1");
        let transaction_1 = vec![operations_1.clone()];
        let transaction_id_2 = Uuid::new_v4();
        let operations_2 = operation(&mut grid, 1, 0, "2");
        let transaction_2 = vec![operations_2.clone()];

        state
            .push_pubsub(transaction_id_1, file_id, transaction_1.clone(), 1)
            .await
            .unwrap();
        let transaction = state.get_messages_from_pubsub(&file_id, 0).await.unwrap();
        let expected_transaction_1 = TransactionServer {
            id: transaction_id_1,
            file_id,
            operations: transaction_1,
            sequence_num: 1,
        };
        assert_eq!(transaction[0], expected_transaction_1);

        state
            .push_pubsub(transaction_id_2, file_id, transaction_2.clone(), 2)
            .await
            .unwrap();
        let transaction = state.get_messages_from_pubsub(&file_id, 0).await.unwrap();
        let expected_transaction_2 = TransactionServer {
            id: transaction_id_2,
            file_id,
            operations: transaction_2,
            sequence_num: 2,
        };
        assert_eq!(
            transaction,
            vec![expected_transaction_1, expected_transaction_2.clone()]
        );

        let last_transaction = state.get_last_message_pubsub(&file_id).await.unwrap();
        assert_eq!(last_transaction.0, "2".to_string());
        assert_eq!(
            last_transaction.1,
            serde_json::to_string(&expected_transaction_2).unwrap()
        );
    }
}
