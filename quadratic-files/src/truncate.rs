use chrono::{Days, Utc};
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
pub(crate) async fn truncate_processed_transactions(
    state: &Arc<State>,
    processed_transactions_channel: &str,
    transaction_age_days: u64,
) -> Result<()> {
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

    // collect info for stats
    state.stats.lock().await.channels_to_truncate_in_pubsub = messages.len() as u64;

    for (file_id, sequence_num) in messages.iter() {
        if let Err(error) = truncate_processed_transaction(
            state,
            processed_transactions_channel,
            file_id,
            sequence_num,
        )
        .await
        {
            tracing::error!("Error truncating channel {file_id}.{sequence_num}: {error}");
        };
    }

    Ok(())
}

#[cfg(test)]
mod tests {

    #[tokio::test]
    async fn truncates_files() {}
}
