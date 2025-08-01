use chrono::Utc;
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
    quadratic_api::{get_file_checkpoint, set_file_checkpoint},
    storage::{Storage, StorageContainer},
};

use crate::{
    error::{CoreCloudError, Result},
    state::{State, settings::Settings},
};

pub static GROUP_NAME: &str = "quadratic-core-cloud-1";

/// Load a .grid file
pub(crate) fn load_file(key: &str, file: Vec<u8>) -> Result<Grid> {
    import(file).map_err(|e| CoreCloudError::ImportFile(key.into(), e.to_string()))
}

/// Exports a .grid file
pub(crate) fn export_file(key: &str, grid: Grid) -> Result<Vec<u8>> {
    export(grid).map_err(|e| CoreCloudError::ExportFile(key.into(), e.to_string()))
}

/// Apply a vec of operations to the grid
pub(crate) fn apply_transaction(grid: &mut GridController, operations: Vec<Operation>) {
    grid.server_apply_transaction(operations, None)
}

/// Loads a .grid file
pub(crate) async fn get_and_load_object(
    storage: &StorageContainer,
    key: &str,
    sequence_num: u64,
) -> Result<GridController> {
    let body = storage
        .read(key)
        .await
        .map_err(|e| CoreCloudError::LoadFile(key.into(), e.to_string()))?;
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
    scheduled_tasks: &str,
) -> Result<Option<u64>> {
    let start = Utc::now();
    let channel = &file_id.to_string();

    let Settings {
        storage,
        quadratic_api_uri,
        m2m_auth_token,
        ..
    } = &state.settings;

    let checkpoint_sequence_num =
        match get_file_checkpoint(quadratic_api_uri, m2m_auth_token, &file_id).await {
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
        .get_messages_from(channel, &(checkpoint_sequence_num + 1).to_string(), false)
        .await?
        .into_iter()
        .flat_map(|(_, message)| Transaction::process_incoming(&message))
        .collect::<Vec<TransactionServer>>();

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
        .ok_or_else(|| CoreCloudError::Unknown("No transactions to process".into()))?;

    let last_sequence_num = sequence_numbers
        .last()
        .cloned()
        .ok_or_else(|| CoreCloudError::Unknown("No transactions to process".into()))?;

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
                .map_err(|e| CoreCloudError::Serialization(e.to_string()))
        })
        .flatten()
        .collect::<Vec<Operation>>();

    // process the transactions and save the file to S3
    let start_processing = Utc::now();
    let last_sequence_num = process_transactions(
        storage,
        file_id,
        checkpoint_sequence_num,
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
        .ack(channel, GROUP_NAME, keys, Some(scheduled_tasks), false)
        .await?;

    drop(pubsub);

    // update the checkpoint in quadratic-api
    let key = &key(file_id, last_sequence_num);
    set_file_checkpoint(
        quadratic_api_uri,
        m2m_auth_token,
        &file_id,
        last_sequence_num,
        CURRENT_VERSION.into(),
        key.to_owned(),
        storage.path().to_owned(),
    )
    .await?;

    state.stats.lock().await.last_processed_file_time = Some(Utc::now());

    tracing::info!(
        "Processed sequence numbers {first_sequence_num} - {last_sequence_num} for room {file_id} in {:?}ms",
        (Utc::now() - start).num_milliseconds()
    );

    Ok(Some(last_sequence_num))
}

/// Get a list of scheduled tasks from the pubsub server
pub(crate) async fn get_scheduled_tasks(
    state: &Arc<State>,
    scheduled_tasks: &str,
) -> Result<Vec<Uuid>> {
    println!("scheduled_tasks: {:?}", scheduled_tasks);
    let scheduled_tasks = state
        .pubsub
        .lock()
        .await
        .connection
        .scheduled_tasks(scheduled_tasks)
        .await?;

    println!("scheduled_tasks: {:?}", scheduled_tasks);
    // .into_iter()
    // .flat_map(|file_id| Uuid::parse_str(&file_id))
    // .collect::<Vec<_>>();

    Ok(vec![])
}

/// Process outstanding transactions in the queue
pub(crate) async fn process(state: &Arc<State>, scheduled_tasks: &str) -> Result<()> {
    let files = get_scheduled_tasks(state, scheduled_tasks).await?;

    // collect info for stats
    state.stats.lock().await.files_to_process_in_pubsub = files.len() as u64;

    for file_id in files.into_iter() {
        let state = Arc::clone(state);
        let scheduled_tasks = scheduled_tasks.to_owned();

        // process file in a separate thread
        tokio::spawn(async move {
            // TODO(ddimaria): instead of logging the error, move the file to a dead letter queue
            if let Err(error) = process_queue_for_room(&state, file_id, &scheduled_tasks).await {
                tracing::error!("Error processing file {file_id}: {error}");
            };
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::{
        proto::response::decode_scheduled_task,
        // state::pubsub::ScheduledTask,
        test_util::{GROUP_NAME_TEST, setup},
    };

    use super::*;
    use quadratic_core::{CellValue, Pos, SheetPos};
    use quadratic_rust_shared::protobuf::quadratic::transaction::ScheduledTask as ScheduledTaskProto;

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
    async fn processes_a_scheduled_task() {
        let (_config, state, channel) = setup().await;
        println!("channel: {:?}", channel);
        let scheduled_tasks = state
            .pubsub
            .lock()
            .await
            .connection
            .messages(
                &channel.to_string(),
                GROUP_NAME_TEST,
                "consumer",
                None,
                10,
                false,
            )
            .await
            .unwrap()
            .into_iter()
            .map(|(_, message)| decode_scheduled_task(&message))
            .collect::<Vec<Result<ScheduledTaskProto>>>();

        for scheduled_task in scheduled_tasks {
            // TODO(ddimaria): send transaction to multiplayer
            println!("scheduled_task: {:?}", scheduled_task.unwrap());
        }
    }
}
