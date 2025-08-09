use quadratic_core::SheetPos;
use quadratic_core::controller::GridController;
use quadratic_core::controller::active_transactions::pending_transaction::PendingTransaction;
use quadratic_core::controller::execution::TransactionSource;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_rust_shared::storage::StorageContainer;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::{CoreCloudError, Result};
use crate::file::{file_key, get_and_load_object};
use crate::get_mut_worker;
use crate::multiplayer::{connect, enter_room, send_transaction};
use crate::state::State;

#[derive(Debug, Clone)]
pub(crate) enum WorkerMessages {
    RunPython(String),
}

#[derive(Debug, Clone)]
pub(crate) enum WorkerState {
    Starting,
    Running,
    Stopping,
    Stopped,
}

#[derive(Debug, Clone)]
pub(crate) struct Worker {
    pub(crate) file_id: Uuid,
    pub(crate) state: WorkerState,
    pub(crate) sequence_num: u64,
    pub(crate) file: Arc<Mutex<GridController>>,
}

impl Worker {
    pub(crate) async fn new(
        file_id: Uuid,
        sequence_num: u64,
        storage: &StorageContainer,
    ) -> Result<Self> {
        let key = file_key(file_id, sequence_num);
        let file = get_and_load_object(storage, &key, sequence_num).await?;

        Ok(Worker {
            file_id,
            state: WorkerState::Running,
            sequence_num,
            file: Arc::new(Mutex::new(file)),
        })
    }

    /// Start a new worker for a given file.
    /// This currently just creates a worker in state, but will spin up a
    /// docker container in the future.
    /// Returns true if the worker is new, false if it already exists.
    pub(crate) async fn startup(file_id: Uuid, state: Arc<State>) -> Result<bool> {
        let is_new_worker = state.create_worker(file_id, 0).await?;

        Ok(is_new_worker)
    }

    /// Shutdown a worker for a given file.
    /// This currently just removes the worker from state, but will stop the
    /// docker container in the future.
    /// Returns the number of workers left.
    pub(crate) async fn shutdown(file_id: Uuid, state: Arc<State>) -> Result<usize> {
        let num_workers = state.destroy_worker(file_id).await?;

        Ok(num_workers)
    }

    /// Enter the room for a given file.
    /// This will connect to the multiplayer server and enter the room for the
    /// given file.
    /// Returns true if the worker is new, false if it already exists.
    pub(crate) async fn enter_room(file_id: Uuid, state: Arc<State>) -> Result<()> {
        let (mut websocket, response) = connect(&state).await?;
        let (mut sender, mut receiver) = websocket.split();
        let user_id = Uuid::new_v4();
        let session_id = Uuid::new_v4();
        enter_room(&mut sender, user_id, file_id, session_id).await?;

        tracing::info!("Entered room {file_id}");

        if response.status() != 200 {
            return Err(CoreCloudError::Multiplayer(format!(
                "Failed to enter room {file_id}, status: {}",
                response.status()
            )));
        }

        let id = send_transaction(&mut sender, file_id, session_id, vec![]).await?;

        tracing::info!("Sent transaction {id} to {file_id}");

        Ok(())
    }

    /// Process an operation.
    /// This will create a pending transaction and apply it to the file.
    pub(crate) async fn process_operation(
        file_id: Uuid,
        state: Arc<State>,
        operation: Operation,
    ) -> Result<()> {
        let file = get_mut_worker!(state, file_id)?.file.clone();
        let mut pending_transaction = PendingTransaction::default();
        pending_transaction.operations.push_back(operation);
        pending_transaction.id = Uuid::new_v4();
        pending_transaction.source = TransactionSource::Server;

        let forward_transaction = pending_transaction.to_forward_transaction();

        file.lock()
            .await
            .server_apply_transaction(forward_transaction.operations, None);

        Ok(())
    }

    /// Compute code for a given sheet position.
    pub(crate) async fn compute_code(
        file_id: Uuid,
        state: Arc<State>,
        sheet_pos: SheetPos,
    ) -> Result<()> {
        let operation = Operation::ComputeCode { sheet_pos };
        Self::process_operation(file_id, state, operation).await
    }

    /// Increment the sequence number.
    pub(crate) fn increment_sequence_num(&mut self) -> u64 {
        self.sequence_num += 1;
        self.sequence_num
    }
}
