use quadratic_core::SheetPos;
use quadratic_core::cell_values::CellValues;
use quadratic_core::controller::GridController;
use quadratic_core::controller::active_transactions::transaction_name::TransactionName;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_rust_shared::net::websocket_client::{WebSocketReceiver, WebSocketSender};
use quadratic_rust_shared::storage::StorageContainer;
use std::fmt::{self, Debug};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::core::process_transaction;
use crate::error::{CoreCloudError, Result};
use crate::file::{file_key, get_and_load_object};
use crate::multiplayer::{connect, enter_room, send_transaction};
use crate::state::State;

// messages to care about (see multiplayerServer.ts)
// 2. BinaryTransaction (receive and apply)
// 3. TransactionAck (recieve and close CRON)
// 4. CurrentTransaction
// 5. Error

#[derive(Debug, Clone)]
pub(crate) enum WorkerMessages {
    RunPython(String),
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum WorkerState {
    Starting,
    Running,
    Stopping,
    Stopped,
}

#[derive(Clone)]
pub(crate) struct Worker {
    pub(crate) file_id: Uuid,
    pub(crate) state: WorkerState,
    pub(crate) sequence_num: u64,
    pub(crate) session_id: Uuid,
    pub(crate) file: Arc<Mutex<GridController>>,
    pub(crate) websocket_sender: Option<Arc<Mutex<WebSocketSender>>>,
    pub(crate) websocket_receiver: Option<Arc<Mutex<WebSocketReceiver>>>,
}

impl Debug for Worker {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Worker {{ file_id: {:?}, state: {:?}, sequence_num: {}, websocket_connected: {} }}",
            self.file_id,
            self.state,
            self.sequence_num,
            self.is_connected()
        )
    }
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
            session_id: Uuid::new_v4(),
            file: Arc::new(Mutex::new(file)),
            websocket_sender: None,
            websocket_receiver: None,
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
    pub(crate) async fn shutdown(&mut self, state: Arc<State>) -> Result<usize> {
        let num_workers = state.destroy_worker(self.file_id).await?;

        Ok(num_workers)
    }

    pub(crate) fn is_connected(&self) -> bool {
        self.websocket_sender.is_some() && self.websocket_receiver.is_some()
    }

    /// Connect to the multiplayer server.
    /// This will connect to the multiplayer server and create a new websocket
    /// sender and receiver.
    pub(crate) async fn connect(&mut self, state: Arc<State>) -> Result<()> {
        if !self.is_connected() {
            let (websocket, _response) = connect(&state).await?;
            let (sender, receiver) = websocket.split();

            self.websocket_sender = Some(Arc::new(Mutex::new(sender)));
            self.websocket_receiver = Some(Arc::new(Mutex::new(receiver)));
        }

        Ok(())
    }

    /// Enter the room for a given file.
    /// This will connect to the multiplayer server and enter the room for the
    /// given file.
    /// Returns true if the worker is new, false if it already exists.
    pub(crate) async fn enter_room(&mut self, file_id: Uuid) -> Result<()> {
        if let Some(sender) = self.websocket_sender.as_mut() {
            let user_id = Uuid::new_v4();
            enter_room(&mut *sender.lock().await, user_id, file_id, self.session_id).await?;

            tracing::info!("Entered room {file_id}");
        }

        Ok(())
    }

    /// Process an operation.
    /// This will create a pending transaction and apply it to the file.
    pub(crate) async fn process_operation(&mut self, operation: Operation) -> Result<()> {
        // // Take ownership of the GridController, process it, then put it back
        // let file_for_transaction = {
        //     let mut file_guard = self.file.lock().await;
        //     std::mem::replace(&mut *file_guard, GridController::default())
        // };

        process_transaction(
            self.file.clone(),
            vec![operation],
            None,
            TransactionName::Unknown,
        )
        .await?;

        let file_lock = self.file.lock().await;
        let forward_transaction = file_lock.last_transaction().unwrap();

        if let Some(sender) = self.websocket_sender.as_mut() {
            send_transaction(
                &mut *sender.lock().await,
                self.file_id,
                self.session_id,
                forward_transaction.operations.to_owned(),
            )
            .await?;
        }

        Ok(())
    }

    /// Compute code for a given sheet position.
    pub(crate) async fn compute_code(&mut self, sheet_pos: SheetPos) -> Result<()> {
        let operation = Operation::ComputeCode { sheet_pos };
        self.process_operation(operation).await
    }

    pub(crate) async fn set_cell_values(
        &mut self,
        sheet_pos: SheetPos,
        values: CellValues,
    ) -> Result<()> {
        let operation = Operation::SetCellValues { sheet_pos, values };
        self.process_operation(operation).await
    }

    /// Increment the sequence number.
    pub(crate) fn increment_sequence_num(&mut self) -> u64 {
        self.sequence_num += 1;
        self.sequence_num
    }

    /// Update the worker's state.
    pub(crate) fn update_state(&mut self, state: WorkerState) {
        self.state = state;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use quadratic_core::{CellValue, grid::SheetId};
    use std::{str::FromStr, time::Duration};

    use crate::{get_mut_worker, test_util::setup};

    #[tokio::test(flavor = "multi_thread")]
    async fn test_worker_startup() {
        let (_, state, _) = setup().await;
        let file_id = Uuid::parse_str("16baaecd-3633-4ac4-b1a7-68b36a00cc70").unwrap();
        let get_state = async || state.get_worker(&file_id).await.unwrap().state;
        let sheet_id = SheetId::from_str("b8718a71-e4b1-49bb-8f32-f0d931850cfd").unwrap();

        // first, start a worker
        let is_new_worker = Worker::startup(file_id, state.clone()).await.unwrap();
        assert!(is_new_worker);
        assert_eq!(state.num_workers().await.unwrap(), 1);
        assert_eq!(get_state().await, WorkerState::Running);

        // then, connect to the multiplayer server
        get_mut_worker!(state, file_id)
            .unwrap()
            .connect(state.clone())
            .await
            .unwrap();

        // get the multiplayer receiver
        let receiver = state
            .get_worker(&file_id)
            .await
            .unwrap()
            .websocket_receiver
            .unwrap();

        // listen for messages in a separate thread
        // TODO(ddimaria): ensure that we receive ACKs for all transactions
        tokio::spawn(async move {
            while let Ok(message) = receiver.lock().await.receive().await {
                // ignore if the string containts "UserUpdate"
                let message = message.unwrap();
                if message.contains("TransactionAck") {
                    println!("message: {:?}", message);
                }
            }
        });

        // then, enter the room
        get_mut_worker!(state, file_id)
            .unwrap()
            .enter_room(file_id)
            .await
            .unwrap();

        // then, set cell value of A2 to 5
        get_mut_worker!(state, file_id)
            .unwrap()
            .set_cell_values(
                SheetPos::new(sheet_id, 1, 2),
                CellValues::from(vec![vec![CellValue::Number(5.into())]]),
            )
            .await
            .unwrap();

        // then, compute code at A4
        get_mut_worker!(state, file_id)
            .unwrap()
            .compute_code(SheetPos::new(sheet_id, 1, 4))
            .await
            .unwrap();

        state.destroy_worker(file_id).await.unwrap();
        assert_eq!(state.num_workers().await.unwrap(), 0);

        // wait 1 minute to show presence in the demo
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}
