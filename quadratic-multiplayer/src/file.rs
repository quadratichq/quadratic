use tokio::sync::Mutex;
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
    quadratic_api::set_file_checkpoint,
};

use crate::{
    error::{MpError, Result},
    state::transaction_queue::TransactionQueue,
};

pub static GROUP_NAME: &str = "quadratic-file-service-1";
pub static MAX_MESSAGES: usize = 10;

/// Load a .grid file
pub(crate) fn load_file(file: &str) -> Result<Grid> {
    import(file).map_err(|e| MpError::FileService(e.to_string()))
}

/// Exports a .grid file
pub(crate) fn export_file(grid: &mut Grid) -> Result<Vec<u8>> {
    export_vec(grid).map_err(|e| MpError::FileService(e.to_string()))
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
        .map_err(|e| MpError::FileService(e.to_string()))?
        .into_bytes();
    let body = std::str::from_utf8(&body).map_err(|e| MpError::FileService(e.to_string()))?;
    let grid = load_file(body)?;

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
    sequence: u64,
    operations: Vec<Operation>,
) -> Result<u64> {
    let num_operations = operations.len();
    let mut grid = get_and_load_object(client, bucket, &key(file_id, sequence), sequence).await?;

    apply_transaction(&mut grid, operations);
    let body = export_file(grid.grid_mut())?;

    let next_sequence_num = sequence + num_operations as u64;
    let key = key(file_id, next_sequence_num);
    upload_object(client, bucket, &key, &body).await?;

    Ok(next_sequence_num)
}

/// Process outstanding transactions in the queue
pub(crate) async fn process_queue_for_room(
    client: &Client,
    bucket: &str,
    transaction_queue: &Mutex<TransactionQueue>,
    file_id: &Uuid,
    base_url: &str,
    jwt: &str,
) -> Result<Option<u64>> {
    // this is an expensive lock since we're waiting for the file to write to S3 before unlocking
    let mut transaction_queue = transaction_queue.lock().await;
    // let transactions = transaction_queue
    //     .get_pending(*file_id)
    //     .unwrap_or_else(|_| vec![]);

    let channel = &file_id.to_string();

    transaction_queue
        .pubsub
        .connection
        .subscribe(channel, GROUP_NAME)
        .await?;

    let transactions = transaction_queue
        .pubsub
        .connection
        .messages(channel, GROUP_NAME, None, MAX_MESSAGES)
        .await?
        .iter()
        .map(|(_, message)| {
            let transaction = serde_json::from_str::<TransactionServer>(&message).unwrap();
            transaction
        })
        .collect::<Vec<TransactionServer>>();

    if transactions.is_empty() {
        return Ok(None);
    }

    tracing::info!(
        "Found {} transactions for room {file_id}",
        transactions.len()
    );

    let sequence_numbers = transactions
        .iter()
        .map(|transaction| transaction.sequence_num)
        .collect::<Vec<u64>>();

    let first_sequence_num = sequence_numbers
        .first()
        .cloned()
        .ok_or_else(|| MpError::FileService("No transactions to process".into()))?;

    let checkpoint_sequence_num = (first_sequence_num - 1).max(0);

    // combine all operations into a single vec
    let operations = transactions
        .into_iter()
        .flat_map(|transaction| {
            tracing::info!(
                "Processing transaction {}, sequence number {} for room {file_id}",
                transaction.id,
                transaction.sequence_num
            );

            transaction.operations
        })
        .collect::<Vec<Operation>>();

    // process the transactions and save the file to S3
    let last_sequence_num = process_transactions(
        client,
        bucket,
        *file_id,
        checkpoint_sequence_num,
        operations,
    )
    .await?;

    let keys = sequence_numbers
        .iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    let keys = keys.iter().map(AsRef::as_ref).collect::<Vec<_>>();

    // remove transactions from the queue
    transaction_queue
        .pubsub
        .connection
        .ack(channel, GROUP_NAME, keys)
        .await?;

    // update the checkpoint in quadratic-api
    let key = &key(*file_id, last_sequence_num);
    set_file_checkpoint(
        base_url,
        jwt,
        file_id,
        last_sequence_num,
        CURRENT_VERSION.into(),
        key.to_owned(),
        bucket.to_owned(),
    )
    .await?;

    tracing::info!(
        "Processed sequence numbers {first_sequence_num} - {last_sequence_num} for room {file_id}"
    );

    Ok(Some(last_sequence_num))
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core::{CellValue, Pos, SheetPos};

    #[test]
    fn loads_a_file() {
        let file = load_file(include_str!(
            "../../quadratic-rust-shared/data/grid/v1_4_simple.grid"
        ))
        .unwrap();

        let mut client = GridController::from_grid(file.clone(), 0);
        let sheet_id = client.sheet_ids().first().unwrap().to_owned();
        let summary = client.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".to_string(),
            None,
        );
        let sheet = client.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );

        let mut server = GridController::from_grid(file, 0);
        apply_transaction(
            &mut server,
            serde_json::from_str(&summary.operations.unwrap()).unwrap(),
        );
        let sheet = server.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("hello".to_string()))
        );
    }

    // #[tokio::test]
    // async fn processes_a_file() {
    //     let config = config().unwrap();
    //     let client = new_client(
    //         &config.aws_s3_access_key_id,
    //         &config.aws_s3_secret_access_key,
    //         &config.aws_s3_region,
    //     )
    //     .await;

    //     let file_id = Uuid::from_str("daf6008f-d858-4a6a-966b-928213048941").unwrap();
    //     let sequence = 0;
    //     let key = key(file_id, sequence);

    //     let file = download_object(&client, &config.aws_s3_bucket_name, &key)
    //         .await
    //         .unwrap();
    //     let body = file.body.collect().await.unwrap().into_bytes();
    //     let body = std::str::from_utf8(&body).unwrap();
    //     println!("{:?}", body);
    //     return;

    //     // let mut grid = get_and_load_object(&client, &config.aws_s3_bucket_name, &key)
    //     //     .await
    //     //     .unwrap();
    //     // let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
    //     // let sheet_rect = SheetPos {
    //     //     x: 0,
    //     //     y: 0,
    //     //     sheet_id,
    //     // }
    //     // .into();
    //     // let value = CellValue::Text("hello".to_string());
    //     // let values = Array::from(value);
    //     // let operation = Operation::SetCellValues { sheet_rect, values };

    //     // process_transactions(
    //     //     &client,
    //     //     &config.aws_s3_bucket_name,
    //     //     file_id,
    //     //     sequence,
    //     //     vec![operation],
    //     // )
    //     // .await
    //     // .unwrap();
    // }
}
