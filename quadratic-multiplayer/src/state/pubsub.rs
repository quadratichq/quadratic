use quadratic_core::controller::transaction::{Transaction, TransactionServer};
use quadratic_rust_shared::{
    multiplayer::message::response::MessageResponse,
    pubsub::{Config as PubSubConfig, PubSub as PubSubTrait, redis_streams::RedisConnection},
};
use uuid::Uuid;

use crate::{
    error::{MpError, Result},
    message::proto::response::encode_message,
};

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

    pub(crate) async fn push_protobuf(
        &mut self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<u8>,
        sequence_num: u64,
        active_channels: &str,
    ) -> Result<u64> {
        let transaction = MessageResponse::BinaryTransaction {
            id,
            file_id,
            operations,
            sequence_num,
        };

        // turn BinaryTransaction into Protobuf
        let encoded = encode_message(transaction)?;

        // add header to the message
        let transaction_compressed =
            Transaction::add_header(encoded).map_err(|e| MpError::Serialization(e.to_string()))?;

        // publish the message to the PubSub server
        self.connection
            .publish(
                &file_id.to_string(),
                &sequence_num.to_string(),
                &transaction_compressed,
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
            .subscribe(&file_id.to_string(), group_name, None)
            .await?;

        Ok(())
    }

    /// Push a transaction to the transaction queue
    pub(crate) async fn push(
        &self,
        id: Uuid,
        file_id: Uuid,
        operations: Vec<u8>,
        sequence_num: u64,
    ) -> Result<u64> {
        self.pubsub
            .lock()
            .await
            .push_protobuf(id, file_id, operations, sequence_num, &self.active_channels)
            .await
    }

    pub(crate) async fn get_messages_from_pubsub(
        &self,
        file_id: &Uuid,
        min_sequence_num: u64,
    ) -> Result<Vec<TransactionServer>> {
        Ok(self
            .pubsub
            .lock()
            .await
            .connection
            .get_messages_after(&file_id.to_string(), &min_sequence_num.to_string(), false)
            .await?
            .into_iter()
            .flat_map(|(_, message)| Transaction::process_incoming(&message))
            .collect::<Vec<TransactionServer>>())
    }

    /// Get the last message from the PubSub channel
    /// Returns a tuple of (sequence number, last message)
    pub(crate) async fn get_last_message_pubsub(
        &self,
        file_id: &Uuid,
    ) -> Result<(String, TransactionServer)> {
        let message = self
            .pubsub
            .lock()
            .await
            .connection
            .last_message(&file_id.to_string(), false)
            .await?;

        let transaction = Transaction::process_incoming(&message.1)
            .map_err(|e| MpError::Serialization(e.to_string()))?;

        Ok((message.0, transaction))
    }

    #[cfg(test)]
    #[allow(unused)]
    pub(crate) async fn ack_message(&self, file_id: &Uuid, sequence_num: u64) -> Result<()> {
        let channel = file_id.to_string();
        let active_channels = "ACTIVE_CHANNELS";
        let sequence_num = sequence_num.to_string();
        let keys = vec![sequence_num.as_ref()];
        let group_name = crate::test_util::GROUP_NAME_TEST;
        self.pubsub
            .lock()
            .await
            .connection
            .ack(&channel, group_name, keys, Some(active_channels), false)
            .await?;

        Ok(())
    }

    #[cfg(test)]
    #[allow(unused)]
    pub(crate) async fn trim_message(&self, file_id: &Uuid, sequence_num: u64) -> Result<()> {
        let channel = file_id.to_string();
        let sequence_num = sequence_num.to_string();
        self.pubsub
            .lock()
            .await
            .connection
            .trim(&channel, &sequence_num)
            .await?;

        Ok(())
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
        let transaction_1 =
            Transaction::serialize_and_compress(vec![operations_1.clone()]).unwrap();

        let transaction_id_2 = Uuid::new_v4();
        let operations_2 = operation(&mut grid, 1, 0, "2");
        let transaction_2 =
            Transaction::serialize_and_compress(vec![operations_2.clone()]).unwrap();

        state
            .push(transaction_id_1, file_id, transaction_1.clone(), 1)
            .await
            .unwrap();
        let transactions = state.get_messages_from_pubsub(&file_id, 0).await.unwrap();
        let expected_transaction_1 = TransactionServer {
            id: transaction_id_1,
            file_id,
            operations: transaction_1,
            sequence_num: 1,
        };

        assert_eq!(transactions[0], expected_transaction_1);

        state
            .push(transaction_id_2, file_id, transaction_2.clone(), 2)
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
        assert_eq!(last_transaction.1, expected_transaction_2);
    }
}
