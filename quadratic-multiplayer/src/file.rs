use aws_config::{retry::RetryConfig, BehaviorVersion, Region};
use aws_sdk_s3::{
    config::{Credentials, SharedCredentialsProvider},
    operation::{get_object::GetObjectOutput, put_object::PutObjectOutput},
    primitives::{ByteStream, SdkBody},
    Client,
};
use quadratic_core::{
    controller::{
        operations::operation::Operation, transaction_summary::TransactionSummary, GridController,
    },
    grid::{
        file::{export_vec, import},
        Grid,
    },
};
use quadratic_rust_shared::quadratic_api::set_file_checkpoint;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{
    error::{MpError, Result},
    state::transaction_queue::TransactionQueue,
};

pub(crate) async fn new_client(
    access_key_id: &str,
    secret_access_key: &str,
    region: &str,
) -> Client {
    let creds = Credentials::new(
        access_key_id,
        secret_access_key,
        None,
        None,
        "Quadratic File Service",
    );
    let conf = aws_config::SdkConfig::builder()
        .region(Region::new(region.to_owned()))
        .credentials_provider(SharedCredentialsProvider::new(creds))
        .retry_config(RetryConfig::standard().with_max_attempts(5))
        .behavior_version(BehaviorVersion::latest())
        .build();

    Client::new(&conf)
}

/// Load a .grid file
pub(crate) fn load_file(file: &str) -> Result<Grid> {
    import(file).map_err(|e| MpError::FileService(e.to_string()))
}

/// Exports a .grid file
pub(crate) fn export_file(grid: &mut Grid) -> Result<Vec<u8>> {
    export_vec(grid).map_err(|e| MpError::FileService(e.to_string()))
}

pub(crate) async fn download_object(
    client: &Client,
    bucket: &str,
    key: &str,
) -> Result<GetObjectOutput> {
    client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|error| {
            MpError::S3(format!(
                "Error retrieving file {} from bucket {}: {:?}.",
                key, bucket, error
            ))
        })
}

pub(crate) async fn upload_object(
    client: &Client,
    bucket: &str,
    key: &str,
    body: &[u8],
) -> Result<PutObjectOutput> {
    let body = ByteStream::from(SdkBody::from(body));
    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body)
        .send()
        .await
        .map_err(|error| {
            MpError::S3(format!(
                "Error uploading file {key} to bucket {bucket}: {:?}.",
                error
            ))
        })
}

/// Apply a vec of operations to the grid
pub(crate) fn apply_operations(
    grid: &mut GridController,
    operations: Vec<Operation>,
) -> Result<TransactionSummary> {
    Ok(grid.apply_received_transaction(operations))
}

/// Exports a .grid file
pub(crate) async fn get_and_load_object(
    client: &Client,
    bucket: &str,
    key: &str,
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

    Ok(GridController::from_grid(grid))
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
    trasaction: Vec<Operation>,
) -> Result<u64> {
    let num_operations = trasaction.len();
    let mut grid = get_and_load_object(client, bucket, &key(file_id, sequence)).await?;

    let _ = apply_operations(&mut grid, trasaction);
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
    let transactions = transaction_queue
        .get_pending(*file_id)
        .unwrap_or_else(|_| vec![]);

    if transactions.is_empty() {
        return Ok(None);
    }

    tracing::info!(
        "Found {} transactions for room {file_id}",
        transactions.len()
    );

    let first_sequence_num = transactions.first().unwrap().sequence_num;
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

    // remove transactions from the queue
    // TODO(ddimaria): this assumes the queue was locked the whole time, confirm this is true
    transaction_queue.complete_transactions(*file_id)?;

    // update the checkpoint in quatratic-api
    let key = &key(*file_id, last_sequence_num);
    set_file_checkpoint(
        base_url,
        jwt,
        file_id,
        last_sequence_num,
        "1.4".into(),
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
    use quadratic_core::test_util::assert_cell_value;
    use quadratic_core::{Array, CellValue, SheetPos};

    #[test]
    fn loads_a_file() {
        let file = load_file(include_str!(
            "../../quadratic-rust-shared/data/grid/v1_4_simple.grid"
        ))
        .unwrap();

        let mut grid = GridController::from_grid(file);
        let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
        let sheet_rect = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        }
        .into();
        let value = CellValue::Text("hello".to_string());
        let values = Array::from(value);
        let operation = Operation::SetCellValues { sheet_rect, values };

        let _ = apply_operations(&mut grid, vec![operation]);

        assert_cell_value(&grid, sheet_id, 0, 0, "hello");
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
