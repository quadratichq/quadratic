use chrono::{Days, Utc};
use quadratic_core::grid::file;
use std::sync::Arc;
use tokio::time::Instant;

use quadratic_rust_shared::pubsub::PubSub as PubSubTrait;

use crate::{
    error::{FilesError, Result},
    file::GROUP_NAME,
    state::State,
};

pub(crate) fn processed_transaction_key(file_id: &str, sequence_num: &str) -> String {
    format!("{}.{}", file_id, sequence_num)
}

pub(crate) fn parse_processed_transaction_key(key: &str) -> Result<(String, String)> {
    let split = key.split('.').collect::<Vec<&str>>();

    if split.len() < 2 {
        return Err(FilesError::Unknown(format!("Could not parse key {key}")));
    }

    Ok((split[0].to_string(), split[1].to_string()))
}

/// Process outstanding transactions in the queue
pub(crate) async fn add_processed_transaction(
    state: &Arc<State>,
    channel: &str,
    message: &str,
) -> Result<()> {
    state
        .pubsub
        .lock()
        .await
        .connection
        .publish(channel, "*", message, None)
        .await?;

    Ok(())
}

/// Process outstanding transactions in the queue
pub(crate) async fn truncate_processed_transaction(
    state: &Arc<State>,
    processed_transactions_channel: &str,
    file_id: &str,
    sequence_num: &str,
) -> Result<()> {
    let start = Instant::now();
    let key = processed_transaction_key(file_id, sequence_num);

    // this is an expensive lock
    let mut pubsub = state.pubsub.lock().await;

    // subscribe to the channel
    pubsub.connection.subscribe(file_id, GROUP_NAME).await?;

    tracing::trace!("Attempting to truncate at sequence number {sequence_num} for file {file_id}");

    // trim the channel at the sequence number using nearly exact trimming
    pubsub.connection.trim(file_id, sequence_num, false).await?;

    // confirm that transactions have been processed
    pubsub
        .connection
        .ack(processed_transactions_channel, GROUP_NAME, vec![&key], None)
        .await?;

    state.stats.lock().await.last_truncated_transaction_time = Some(Instant::now());

    tracing::info!(
        "Truncated at sequence number {sequence_num} for file {file_id} in {:?}",
        start.elapsed()
    );

    Ok(())
}

/// Process outstanding transactions in the queue
pub(crate) async fn get_messages(
    state: &Arc<State>,
    processed_transactions_channel: &str,
    transaction_age_days: u64,
) -> Result<Vec<(String, String)>> {
    // milliseconds from TRANSACTION_AGE_DAYS ago
    let millis = Utc::now()
        .checked_sub_days(Days::new(transaction_age_days))
        .ok_or_else(|| {
            FilesError::Unknown(format!(
                "Could not create a date {transaction_age_days} days from now"
            ))
        })?
        .timestamp_millis();

    // get messages from the channel
    let messages = state
        .pubsub
        .lock()
        .await
        .connection
        .get_messages_before(processed_transactions_channel, &millis.to_string())
        .await?;

    Ok(messages)
}

/// Process outstanding transactions in the queue
pub(crate) async fn truncate_processed_transactions(
    state: &Arc<State>,
    channel: &str,
    transaction_age_days: u64,
) -> Result<()> {
    // get messages from the channel
    let messages = get_messages(state, channel, transaction_age_days).await?;

    // collect info for stats
    state.stats.lock().await.channels_to_truncate_in_pubsub = messages.len() as u64;

    for (_, key) in messages.iter() {
        let (file_id, sequence_num) = parse_processed_transaction_key(key)?;

        if let Err(error) =
            truncate_processed_transaction(state, channel, &file_id, &sequence_num).await
        {
            tracing::error!("Error truncating channel {file_id}.{sequence_num}: {error}");
        };
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;
    use crate::test_util::new_arc_state;

    #[tokio::test]
    async fn truncates_files() {
        let state = new_arc_state().await;
        let channel = format!("processed_transactions_{}", Uuid::new_v4());
        let file_id = Uuid::new_v4();

        // add 10 transactions to the channel
        for i in 1..=10 {
            state
                .pubsub
                .lock()
                .await
                .connection
                .publish(
                    &file_id.to_string(),
                    &format!("{}-0", i),
                    "",
                    Some("active_channels"),
                )
                .await
                .unwrap();

            // only add the first 5 transactions to the processed transactions channel
            if i <= 5 {
                let message = processed_transaction_key(&file_id.to_string(), &i.to_string());
                add_processed_transaction(&state, &channel, &message)
                    .await
                    .unwrap();
            }
        }

        // wait
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // verify the messages are in the FILE_ID channel
        let messages = get_messages(&state, &file_id.to_string(), 0).await.unwrap();
        assert_eq!(messages.len(), 10);

        // verify the messages are in the process_transactions channel
        let messages = get_messages(&state, &channel, 0).await.unwrap();
        assert_eq!(messages.len(), 5);

        truncate_processed_transactions(&state, &channel, 0)
            .await
            .unwrap();

        let messages = get_messages(&state, &channel, 0).await.unwrap();

        println!("messages: {:?}", messages);
    }
}
