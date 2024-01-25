use std::sync::Arc;
use tokio::time::Instant;
use uuid::Uuid;

use quadratic_core::{
    controller::{
        operations::operation::Operation, transaction::TransactionServer, GridController,
    },
    grid::{
        file::{export_vec, import, CURRENT_VERSION},
        Grid,
    },
};
use quadratic_rust_shared::{
    aws::{
        s3::{download_object, upload_object},
        Client,
    },
    pubsub::PubSub as PubSubTrait,
    quadratic_api::{get_file_checkpoint, set_file_checkpoint},
};

use crate::{
    error::{FilesError, Result},
    state::{settings::Settings, State},
};

pub static GROUP_NAME: &str = "quadratic-file-service-1";

/// Load a .grid file
pub(crate) fn load_file(key: &str, file: &str) -> Result<Grid> {
    import(file).map_err(|e| FilesError::ImportFile(key.into(), e.to_string()))
}

/// Exports a .grid file
pub(crate) fn export_file(key: &str, grid: &mut Grid) -> Result<Vec<u8>> {
    export_vec(grid).map_err(|e| FilesError::ExportFile(key.into(), e.to_string()))
}

/// Apply a vec of operations to the grid
pub(crate) fn apply_transaction(grid: &mut GridController, operations: Vec<Operation>) {
    grid.server_apply_transaction(operations)
}

/// Exports a .grid file
pub(crate) async fn get_and_load_object(
    client: &Client,
    bucket: &str,
    key: &str,
    sequence_num: u64,
) -> Result<GridController> {
    let file = download_object(client, bucket, key).await?;
    let body = file
        .body
        .collect()
        .await
        .map_err(|e| FilesError::LoadFile(key.into(), bucket.to_string(), e.to_string()))?
        .into_bytes();
    let body = std::str::from_utf8(&body)
        .map_err(|e| FilesError::LoadFile(key.into(), bucket.to_string(), e.to_string()))?;
    let grid = load_file(key, body)?;

    Ok(GridController::from_grid(grid, sequence_num))
}

pub(crate) fn key(file_id: Uuid, sequence: u64) -> String {
    format!("{file_id}-{sequence}.grid")
}

/// Load a file from S3, add it to memory, process transactions and upload it back to S3
pub(crate) async fn process_transactions(
    client: &Client,
    bucket: &str,
    file_id: Uuid,
    checkpoint_sequence_num: u64,
    final_sequence_num: u64,
    operations: Vec<Operation>,
) -> Result<u64> {
    let mut grid = get_and_load_object(
        client,
        bucket,
        &key(file_id, checkpoint_sequence_num),
        checkpoint_sequence_num,
    )
    .await?;

    let key = key(file_id, final_sequence_num);

    apply_transaction(&mut grid, operations);
    let body = export_file(&key, grid.grid_mut())?;

    upload_object(client, bucket, &key, &body).await?;

    Ok(final_sequence_num)
}

/// Process outstanding transactions in the queue
pub(crate) async fn process_queue_for_room(
    state: &Arc<State>,
    file_id: &Uuid,
    active_channels: &str,
) -> Result<Option<u64>> {
    let start = Instant::now();
    let channel = &file_id.to_string();

    let Settings {
        aws_client,
        aws_s3_bucket_name,
        quadratic_api_uri,
        m2m_auth_token,
        ..
    } = &state.settings;

    let checkpoint_sequence_num =
        match get_file_checkpoint(quadratic_api_uri, m2m_auth_token, file_id).await {
            Ok(last_checkpoint) => last_checkpoint.sequence_number,
            Err(_) => 0,
        };

    // this is an expensive lock since we're waiting for the file to write to S3 before unlocking
    let mut pubsub = state.pubsub.lock().await;

    // subscribe to the channel
    pubsub.connection.subscribe(channel, GROUP_NAME).await?;

    // get all transactions for the room in the queue
    let transactions = pubsub
        .connection
        .get_messages_from(channel, &checkpoint_sequence_num.to_string())
        .await?
        .iter()
        .flat_map(|(_, message)| serde_json::from_str::<TransactionServer>(message))
        .collect::<Vec<TransactionServer>>();

    tracing::info!(
        "Found {} transaction(s) for room {file_id}",
        transactions.len()
    );

    if transactions.is_empty() {
        return Ok(None);
    }

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

            transaction.operations
        })
        .collect::<Vec<Operation>>();

    // process the transactions and save the file to S3
    let last_sequence_num = process_transactions(
        aws_client,
        aws_s3_bucket_name,
        *file_id,
        checkpoint_sequence_num,
        last_sequence_num,
        operations,
    )
    .await?;

    // convert keys to &str requires 2 iterations
    let keys = sequence_numbers
        .iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    let keys = keys.iter().map(AsRef::as_ref).collect::<Vec<_>>();

    // confirm that transactions have been processed
    pubsub
        .connection
        .ack(channel, GROUP_NAME, keys, Some(active_channels))
        .await?;

    // update the checkpoint in quadratic-api
    let key = &key(*file_id, last_sequence_num);
    set_file_checkpoint(
        quadratic_api_uri,
        m2m_auth_token,
        file_id,
        last_sequence_num,
        CURRENT_VERSION.into(),
        key.to_owned(),
        aws_s3_bucket_name.to_owned(),
    )
    .await?;

    state.stats.lock().await.last_processed_file_time = Some(Instant::now());

    tracing::info!(
        "Processed sequence numbers {first_sequence_num} - {last_sequence_num} for room {file_id} in {:?}", start.elapsed()
    );

    Ok(Some(last_sequence_num))
}

/// Process outstanding transactions in the queue
pub(crate) async fn process(state: &Arc<State>, active_channels: &str) -> Result<()> {
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

    // collect info for stats
    state.stats.lock().await.files_to_process_in_pubsub = files.len() as u64;

    for file_id in files.iter() {
        process_queue_for_room(state, file_id, active_channels).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    // use std::str::FromStr;
    // use crate::test_util::new_arc_state;

    use super::*;
    use quadratic_core::{CellValue, Pos, SheetPos};

    #[test]
    fn loads_a_file_and_applies_a_transaction_and_exports_the_file() {
        let key = "test";

        // load the file
        let mut file = load_file(
            key,
            include_str!("../../quadratic-rust-shared/data/grid/v1_4_simple.grid"),
        )
        .unwrap();

        // add a cell value to the file
        let mut gc = GridController::from_grid(file.clone(), 0);
        let sheet_id = gc.sheet_ids().first().unwrap().to_owned();
        let summary = gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".to_string(),
            None,
        );
        let sheet = gc.grid().try_sheet(sheet_id).unwrap();

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );

        // apply a transaction to the file
        apply_transaction(
            &mut gc,
            serde_json::from_str(&summary.operations.unwrap()).unwrap(),
        );
        let sheet = gc.grid().try_sheet(sheet_id).unwrap();

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );

        let grid = export_file(key, &mut file);
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
