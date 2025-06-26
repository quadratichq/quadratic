use chrono::{Days, Utc};
use std::{str::from_utf8, sync::Arc};

use quadratic_rust_shared::pubsub::PubSub as PubSubTrait;

use crate::{
    error::{FilesError, Result},
    state::State,
};

pub(crate) fn processed_transaction_key(file_id: &str, sequence_num: &str) -> String {
    format!("{file_id}.{sequence_num}")
}

pub(crate) fn parse_processed_transaction_key(key: &[u8]) -> Result<(String, String)> {
    let key = from_utf8(key)
        .map_err(|_| FilesError::Unknown("Could not parse key as UTF-8 string".into()))?;
    let split = key.split('.').collect::<Vec<&str>>();

    if split.len() < 2 {
        return Err(FilesError::Unknown(format!("Could not parse key {key}")));
    }

    Ok((split[0].to_string(), split[1].to_string()))
}

/// Process outstanding transactions in the queue, but only for the given key.
/// This is useful for testing as we need to create timestamps in the past
/// rather than accepting NOW() (the default).
async fn add_processed_transaction_with_key(
    state: &Arc<State>,
    channel: &str,
    message: &str,
    key: &str,
) -> Result<()> {
    state
        .pubsub
        .lock()
        .await
        .connection
        .publish(channel, key, message.as_bytes(), None)
        .await?;

    Ok(())
}

/// Process outstanding transactions in the queue
pub(crate) async fn add_processed_transaction(
    state: &Arc<State>,
    channel: &str,
    message: &str,
) -> Result<()> {
    add_processed_transaction_with_key(state, channel, message, "*").await
}

/// Process outstanding transactions in the queue
pub(crate) async fn truncate_processed_transaction(
    state: &Arc<State>,
    processed_transactions_channel: &str,
    key: &str,
    file_id: &str,
    sequence_num: &str,
) -> Result<()> {
    let start = Utc::now();

    // this is an expensive lock
    let mut pubsub = state.pubsub.lock().await;

    tracing::trace!("Attempting to truncate at sequence number {sequence_num} for file {file_id}");

    // Redis does not trim inclusively, so we need to add a 1 to the sequence number
    let inclusive_sequence_num = sequence_num.parse::<u64>().unwrap_or(0) + 1;

    // trim the channel at the sequence number
    pubsub
        .connection
        .trim(file_id, &inclusive_sequence_num.to_string())
        .await?;

    // trim the process transactions channel for this checkpoint
    pubsub
        .connection
        .trim(processed_transactions_channel, key)
        .await?;

    state.stats.lock().await.last_truncated_transaction_time = Some(Utc::now());

    tracing::trace!(
        "Truncated at sequence number {sequence_num} for file {file_id} in {:?}ms",
        (Utc::now() - start).num_milliseconds()
    );

    Ok(())
}

/// Get all messages from the processed transactions channel at the given timestamp (transaction_age_days)
pub(crate) async fn get_messages(
    state: &Arc<State>,
    processed_transactions_channel: &str,
    transaction_age_days: u64,
) -> Result<Vec<(String, Vec<u8>)>> {
    // milliseconds from TRANSACTION_AGE_DAYS ago
    let millis = Utc::now()
        .checked_sub_days(Days::new(transaction_age_days))
        .ok_or_else(|| {
            FilesError::Truncate(format!(
                "Could not create a date {transaction_age_days} days from now"
            ))
        })?
        .timestamp_millis();

    // get all messages from the processed transactions channel (ignores consumer groups)
    let messages = state
        .pubsub
        .lock()
        .await
        .connection
        .get_messages_before(processed_transactions_channel, &millis.to_string(), true)
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

    for (key, value) in messages.iter() {
        let (file_id, sequence_num) = parse_processed_transaction_key(value)?;

        if let Err(error) =
            truncate_processed_transaction(state, channel, key, &file_id, &sequence_num).await
        {
            tracing::error!("Error truncating channel {file_id}.{sequence_num}: {error}");
        };
    }

    state.stats.lock().await.channels_to_truncate_in_pubsub = 0;

    Ok(())
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;
    use crate::test_util::new_arc_state;

    async fn assert_file_messages(state: Arc<State>, file_ids: &Vec<String>, expected: usize) {
        for file_id in file_ids {
            let messages = state
                .pubsub
                .lock()
                .await
                .connection
                .get_messages_before(&file_id.to_string(), "+", false)
                .await
                .unwrap();

            assert_eq!(
                messages.len(),
                expected,
                "expected file {file_id} to have {expected} messages"
            );
        }
    }

    pub(crate) async fn add_processed_transaction_in_days(
        state: &Arc<State>,
        channel: &str,
        message: &str,
        days_old: u64,
    ) -> Result<()> {
        let millis = Utc::now()
            .checked_sub_days(Days::new(days_old))
            .unwrap()
            .timestamp_millis();

        add_processed_transaction_with_key(state, channel, message, &millis.to_string()).await
    }

    #[tokio::test]
    async fn truncates_files() {
        let state = new_arc_state().await;
        let channel = format!("processed_transactions_{}", Uuid::new_v4());
        let mut file_ids = vec![];
        const AGE: u64 = 5;

        // add 10 transactions to 10 channels
        for i in 1..=10 {
            let file_id = Uuid::new_v4();
            file_ids.push(file_id.to_string());

            for j in 1..=10 {
                state
                    .pubsub
                    .lock()
                    .await
                    .connection
                    .publish(
                        &file_id.to_string(),
                        &j.to_string(),
                        format!("message {i}-{j}").as_bytes(),
                        Some("active_channels"),
                    )
                    .await
                    .unwrap();

                // wait
                tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;

                let message = processed_transaction_key(&file_id.to_string(), &j.to_string());
                add_processed_transaction_in_days(&state, &channel, &message, AGE)
                    .await
                    .unwrap();
            }
        }

        // wait
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // verify the messages are in the FILE_ID channel
        assert_file_messages(state.clone(), &file_ids, 10).await;

        // verify the messages are NOT ready to be processed (AGE + 1 days old)
        let process_transactions_messages = get_messages(&state, &channel, AGE + 1).await.unwrap();
        assert_eq!(process_transactions_messages.len(), 0);

        truncate_processed_transactions(&state, &channel, AGE + 1)
            .await
            .unwrap();

        // wait
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // verify the messages are in the FILE_ID channel
        assert_file_messages(state.clone(), &file_ids, 10).await;

        // verify the messages are in the process_transactions channel
        let process_transactions_messages = get_messages(&state, &channel, AGE).await.unwrap();
        assert_eq!(process_transactions_messages.len(), 100);

        truncate_processed_transactions(&state, &channel, 0)
            .await
            .unwrap();

        // wait
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // the most recent message should be remain since redis is range exclusive
        let process_transactions_messages = get_messages(&state, &channel, AGE).await.unwrap();
        assert_eq!(process_transactions_messages.len(), 1);

        // all files should be processed
        assert_file_messages(state.clone(), &file_ids, 0).await;
    }
}
