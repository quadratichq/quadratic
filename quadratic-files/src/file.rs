use chrono::Utc;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use quadratic_core::{
    controller::{
        GridController,
        operations::operation::Operation,
        transaction::{Transaction, TransactionServer},
    },
    grid::{
        Grid,
        file::{CURRENT_VERSION, export, import},
    },
};
use quadratic_rust_shared::{
    pubsub::PubSub as PubSubTrait,
    quadratic_database::checkpoint::{get_max_sequence_number, set_file_checkpoint},
    storage::{Storage, StorageContainer},
};

use crate::{
    error::{FilesError, Result},
    state::State,
    truncate::{add_processed_transaction, processed_transaction_key},
};

pub static GROUP_NAME: &str = "quadratic-file-service-1";

/// Compute a hash of the transactions for duplicate detection.
/// Uses SHA-256 for stability across Rust versions and program runs.
fn compute_transactions_hash(transactions: &[TransactionServer]) -> String {
    let mut hasher = Sha256::new();
    for transaction in transactions {
        hasher.update(transaction.sequence_num.to_le_bytes());
        hasher.update(transaction.id.as_bytes());
        hasher.update(&transaction.operations);
    }
    format!("{:x}", hasher.finalize())
}

/// Load a .grid file
pub(crate) fn load_file(key: &str, file: Vec<u8>) -> Result<Grid> {
    import(file).map_err(|e| FilesError::ImportFile(key.into(), e.to_string()))
}

/// Exports a .grid file
pub(crate) fn export_file(key: &str, grid: Grid) -> Result<Vec<u8>> {
    export(grid).map_err(|e| FilesError::ExportFile(key.into(), e.to_string()))
}

/// Apply a vec of operations to the grid
pub(crate) fn apply_transaction(grid: &mut GridController, operations: Vec<Operation>) {
    grid.server_apply_transaction(operations, None)
}

/// Exports a .grid file
pub(crate) async fn get_and_load_object(
    storage: &StorageContainer,
    key: &str,
    sequence_num: u64,
) -> Result<GridController> {
    let body = storage
        .read(key)
        .await
        .map_err(|e| FilesError::LoadFile(key.into(), e.to_string()))?;
    let grid = load_file(key, body.to_vec())?;

    Ok(GridController::from_grid(grid, sequence_num))
}

pub(crate) fn key(file_id: Uuid, sequence: u64) -> String {
    format!("{file_id}-{sequence}.grid")
}

/// Load a file from S3, add it to memory, process transactions and upload it back to S3
pub(crate) async fn process_transactions(
    storage: &StorageContainer,
    file_id: Uuid,
    checkpoint_sequence_num: u64,
    final_sequence_num: u64,
    operations: Vec<Operation>,
) -> Result<u64> {
    let mut grid = get_and_load_object(
        storage,
        &key(file_id, checkpoint_sequence_num),
        checkpoint_sequence_num,
    )
    .await?;
    let key = key(file_id, final_sequence_num);

    apply_transaction(&mut grid, operations);
    let body = export_file(&key, grid.into_grid())?;

    storage.write(&key, &body.into()).await?;

    Ok(final_sequence_num)
}

/// Process outstanding transactions in the queue
pub(crate) async fn process_queue_for_room(
    state: &Arc<State>,
    file_id: Uuid,
    active_channels: &str,
) -> Result<Option<u64>> {
    let start = Utc::now();
    let channel = &file_id.to_string();

    // When a file is created in API, a zero checkpoint is created, so we
    // should always expect a return value.
    let db_start = Utc::now();
    let checkpoint_sequence_num = get_max_sequence_number(&state.pool, &file_id)
        .await
        .map_err(|e| FilesError::ApiSequenceNumberNotFound(file_id, e.to_string()))?;
    let db_elapsed = (Utc::now() - db_start).num_milliseconds();
    if db_elapsed > 1000 {
        tracing::warn!(
            "Slow DB query for file {file_id}: get_max_sequence_number took {db_elapsed}ms"
        );
    }

    // this is an expensive lock since we're waiting for the file to write to S3 before unlocking
    let mut pubsub = state.pubsub.lock().await;

    // subscribe to the channel
    pubsub
        .connection
        .subscribe(channel, GROUP_NAME, None)
        .await?;

    // get all transactions for the room in the queue
    let messages = pubsub
        .connection
        .get_messages_after(channel, &(checkpoint_sequence_num + 1).to_string(), false)
        .await?;

    let transactions = messages
        .into_iter()
        .flat_map(|(_, message)| Transaction::process_incoming(&message))
        .collect::<Vec<TransactionServer>>();

    if transactions.is_empty() {
        tracing::debug!(
            "File {file_id}: checkpoint={checkpoint_sequence_num}, no transactions found after checkpoint"
        );
        return Ok(None);
    }

    // compute hash for duplicate detection
    let transactions_hash = compute_transactions_hash(&transactions);

    let sequence_numbers = transactions
        .iter()
        .map(|transaction| transaction.sequence_num)
        .collect::<Vec<u64>>();

    let first_sequence_num = sequence_numbers
        .first()
        .cloned()
        .ok_or_else(|| FilesError::Unknown("No transactions to process".into()))?;

    let last_sequence_num = sequence_numbers
        .last()
        .cloned()
        .ok_or_else(|| FilesError::Unknown("No transactions to process".into()))?;

    // combine all operations into a single vec
    let operations = transactions
        .into_iter()
        .flat_map(|transaction| {
            // tracing::info!(
            //     "Processing transaction {}, sequence number {} for room {file_id}",
            //     transaction.id,
            //     transaction.sequence_num
            // );

            Transaction::decompress_and_deserialize::<Vec<Operation>>(&transaction.operations)
                .map_err(|e| FilesError::Serialization(e.to_string()))
        })
        .flatten()
        .collect::<Vec<Operation>>();

    // process the transactions and save the file to S3
    let start_processing = Utc::now();
    let last_sequence_num = process_transactions(
        &state.settings.storage,
        file_id,
        checkpoint_sequence_num as u64,
        last_sequence_num,
        operations,
    )
    .await?;

    tracing::trace!(
        "Processed transactions in {:?}ms",
        (Utc::now() - start_processing).num_milliseconds()
    );

    // convert keys to &str requires 2 iterations
    let keys = sequence_numbers
        .iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    let keys = keys.iter().map(AsRef::as_ref).collect::<Vec<_>>();

    // confirm that transactions have been processed
    pubsub
        .connection
        .ack(channel, GROUP_NAME, keys, Some(active_channels), false)
        .await?;

    drop(pubsub);

    // update the checkpoint in quadratic-api
    set_file_checkpoint(
        &state.pool,
        &file_id,
        last_sequence_num as i32,
        &state.settings.checkpoint_bucket_name,
        CURRENT_VERSION,
        &transactions_hash,
    )
    .await?;

    // add FILE_ID.SEQUENCE_NUM to the processed transactions channel
    let message = processed_transaction_key(&file_id.to_string(), &last_sequence_num.to_string());
    let processed_transactions_channel = state
        .settings
        .pubsub_processed_transactions_channel
        .to_owned();

    add_processed_transaction(
        &Arc::clone(state),
        &processed_transactions_channel,
        &message,
    )
    .await?;

    state.stats.lock().await.last_processed_file_time = Some(Utc::now());

    tracing::info!(
        "Processed sequence numbers {first_sequence_num} - {last_sequence_num} for room {file_id} in {:?}ms",
        (Utc::now() - start).num_milliseconds()
    );

    Ok(Some(last_sequence_num))
}

pub(crate) async fn get_files_to_process(
    state: &Arc<State>,
    active_channels: &str,
) -> Result<Vec<Uuid>> {
    let files = state
        .pubsub
        .lock()
        .await
        .connection
        .active_channels(active_channels)
        .await?
        .into_iter()
        .flat_map(|file_id| Uuid::parse_str(&file_id))
        .collect::<Vec<_>>();

    Ok(files)
}

/// Process a batch of files from the queue.
///
/// Returns the number of files processed in this batch.
/// The caller should call this repeatedly until it returns 0, then wait
/// before checking again.
pub(crate) async fn process_batch(state: &Arc<State>, active_channels: &str) -> Result<usize> {
    let all_files = get_files_to_process(state, active_channels).await?;
    let total_files = all_files.len();

    // Update stats with total queue size
    state.stats.lock().await.files_to_process_in_pubsub = total_files as u64;

    if total_files == 0 {
        return Ok(0);
    }

    // Take only a batch of files to process
    let batch: Vec<Uuid> = all_files.into_iter().take(state.batch_size).collect();
    let batch_size = batch.len();

    tracing::info!(
        "Processing batch of {} files ({} total in queue), pool size: {}",
        batch_size,
        total_files,
        state.pool.size()
    );

    // Process files sequentially to avoid overwhelming the database
    let mut processed = 0;
    let mut skipped = 0;
    let mut errors = 0;
    for file_id in batch {
        // TODO(ddimaria): instead of logging the error, move the file to a dead letter queue
        match process_queue_for_room(state, file_id, active_channels).await {
            Ok(Some(_)) => {
                processed += 1;
            }
            Ok(None) => {
                skipped += 1;
            }
            Err(error) => {
                errors += 1;
                tracing::error!("Error processing file {file_id}: {error}");
            }
        }
    }

    tracing::info!(
        "Batch complete: processed {}, skipped {} (no new transactions), errors {}",
        processed,
        skipped,
        errors
    );

    Ok(processed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core::{CellValue, Pos, SheetPos};

    #[test]
    fn loads_a_file_and_applies_a_transaction_and_exports_the_file() {
        let key = "test";

        // load the file
        let file = load_file(
            key,
            include_bytes!("../../quadratic-rust-shared/data/grid/v1_4_simple.grid").to_vec(),
        )
        .unwrap();

        // add a cell value to the file
        let mut gc = GridController::from_grid(file.clone(), 0);
        let sheet_id = gc.sheet_ids().first().unwrap().to_owned();
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".to_string(),
            None,
            false,
        );
        let transaction = gc.last_transaction().unwrap().clone();
        let sheet = gc.grid().try_sheet(sheet_id).unwrap();

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );

        // apply a transaction to the file
        apply_transaction(&mut gc, transaction.operations);
        let sheet = gc.grid().try_sheet(sheet_id).unwrap();

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );

        let grid = export_file(key, file);
        assert!(grid.is_ok());
    }

    #[tokio::test]
    async fn processes_a_file() {
        // let state = new_arc_state().await;
        // let Settings {
        //     aws_client,
        //     aws_s3_bucket_name,
        //     quadratic_api_uri,
        //     m2m_auth_token,
        //     ..
        // } = &state.settings;

        // println!("{:?}", aws_s3_bucket_name);

        // let file_id = Uuid::from_str("daf6008f-d858-4a6a-966b-928213048941").unwrap();
        // let sequence = 0;
        // let key = key(file_id, sequence);

        // let file = get_and_load_object(&aws_client, aws_s3_bucket_name, &key, 0)
        //     .await
        //     .unwrap();
        // println!("{:?}", file);
        // return;

        // let mut grid = get_and_load_object(&client, &config.aws_s3_bucket_name, &key)
        //     .await
        //     .unwrap();
        // let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
        // let sheet_rect = SheetPos {
        //     x: 0,
        //     y: 0,
        //     sheet_id,
        // }
        // .into();
        // let value = CellValue::Text("hello".to_string());
        // let values = Array::from(value);
        // let operation = Operation::SetCellValues { sheet_rect, values };

        // process_transactions(
        //     &client,
        //     &config.aws_s3_bucket_name,
        //     file_id,
        //     sequence,
        //     vec![operation],
        // )
        // .await
        // .unwrap();
    }
}
