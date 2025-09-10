use quadratic_core::SheetPos;
use quadratic_core::cell_values::CellValues;
use quadratic_core::controller::GridController;
use quadratic_core::controller::active_transactions::transaction_name::TransactionName;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_core::grid::file::import;
use quadratic_rust_shared::net::websocket_client::{WebSocketReceiver, WebSocketSender};
use std::fmt::{self, Debug};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::core::process_transaction;
use crate::error::{CoreCloudError, Result};
use crate::multiplayer::{connect, enter_room, send_transaction};

// messages to care about (see multiplayerServer.ts)
// 2. BinaryTransaction (receive and apply)
// 3. TransactionAck (recieve and close CRON)
// 4. CurrentTransaction
// 5. Error

#[derive(Clone)]
pub struct Worker {
    pub(crate) file_id: Uuid,
    pub(crate) sequence_num: u64,
    pub(crate) session_id: Uuid,
    pub(crate) file: Arc<Mutex<GridController>>,
    pub(crate) m2m_auth_token: String,
    pub(crate) websocket_sender: Option<Arc<Mutex<WebSocketSender>>>,
    pub(crate) websocket_receiver: Option<Arc<Mutex<WebSocketReceiver>>>,
}

impl Debug for Worker {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Worker {{ file_id: {:?}, sequence_num: {}, websocket_connected: {} }}",
            self.file_id,
            self.sequence_num,
            self.is_connected()
        )
    }
}

impl Worker {
    pub async fn new(
        file_id: Uuid,
        sequence_num: u64,
        presigned_url: &str,
        m2m_auth_token: String,
    ) -> Result<Self> {
        let file = Self::load_file(file_id, sequence_num, presigned_url).await?;

        Ok(Worker {
            file_id,
            sequence_num,
            session_id: Uuid::new_v4(),
            file: Arc::new(Mutex::new(file)),
            m2m_auth_token,
            websocket_sender: None,
            websocket_receiver: None,
        })
    }

    /// Load a file from a presigned URL.
    pub async fn load_file(
        file_id: Uuid,
        sequence_num: u64,
        presigned_url: &str,
    ) -> Result<GridController> {
        let res = reqwest::get(presigned_url).await?;
        let file = res.bytes().await?;
        let grid = import(file.to_vec())
            .map_err(|e| CoreCloudError::ImportFile(file_id.into(), e.to_string()))?;

        Ok(GridController::from_grid(grid, sequence_num))
    }

    /// Connect to the multiplayer server.
    /// This will connect to the multiplayer server and create a new websocket
    /// sender and receiver.
    pub async fn connect(&mut self) -> Result<()> {
        if !self.is_connected() {
            let (websocket, _response) = connect(&self.m2m_auth_token).await?;
            let (sender, receiver) = websocket.split();

            self.websocket_sender = Some(Arc::new(Mutex::new(sender)));
            self.websocket_receiver = Some(Arc::new(Mutex::new(receiver)));
        }

        Ok(())
    }

    /// Check if the worker is connected to the multiplayer websocket.
    pub fn is_connected(&self) -> bool {
        self.websocket_sender.is_some() && self.websocket_receiver.is_some()
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
    pub async fn process_operation(&mut self, operation: Operation) -> Result<()> {
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
            "test_team_id".to_string(),
            "M2M_AUTH_TOKEN".to_string(),
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
}

#[cfg(test)]
mod tests {
    use super::*;

    use quadratic_core::{CellValue, grid::SheetId};
    use std::{str::FromStr, time::Duration};

    #[tokio::test(flavor = "multi_thread")]
    async fn test_worker_startup() {
        let file_id = Uuid::parse_str("16baaecd-3633-4ac4-b1a7-68b36a00cc70").unwrap();
        let sheet_id = SheetId::from_str("b8718a71-e4b1-49bb-8f32-f0d931850cfd").unwrap();
        let presigned_url = "https://www.google.com";
        let m2m_auth_token = "M2M_AUTH_TOKEN".to_string();

        let worker = Worker::new(file_id, 0, presigned_url, m2m_auth_token)
            .await
            .unwrap();
        let worker = Arc::new(Mutex::new(worker));

        // connect to the multiplayer server
        worker.lock().await.connect().await.unwrap();

        // get the multiplayer receiver
        let receiver = worker
            .lock()
            .await
            .websocket_receiver
            .as_ref()
            .unwrap()
            .clone();

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
        worker.lock().await.enter_room(file_id).await.unwrap();

        // then, set cell value of A2 to 5
        worker
            .lock()
            .await
            .set_cell_values(
                SheetPos::new(sheet_id, 1, 2),
                CellValues::from(vec![vec![CellValue::Number(5.into())]]),
            )
            .await
            .unwrap();

        // then, compute code at A4
        worker
            .lock()
            .await
            .compute_code(SheetPos::new(sheet_id, 1, 4))
            .await
            .unwrap();

        // wait 1 minute to show presence in the demo
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}
