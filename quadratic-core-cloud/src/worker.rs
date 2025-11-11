use futures_util::StreamExt;
use prost::Message;
use quadratic_core::controller::GridController;
use quadratic_core::controller::active_transactions::transaction_name::TransactionName;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_core::controller::transaction::{Transaction, TransactionServer};
use quadratic_core::grid::file::import;
use quadratic_rust_shared::multiplayer::message::response::MessageResponse;
use quadratic_rust_shared::net::websocket_client::{
    Message as WebsocketMessage, WebSocketReceiver, WebSocketSender,
};
use quadratic_rust_shared::protobuf::quadratic::transaction::{
    ReceiveTransaction, ReceiveTransactions,
};
use quadratic_rust_shared::protobuf::utils::type_name_from_peek;
use std::fmt::{self, Debug};
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};
use tokio::task::JoinHandle;
use tokio::time::Duration;
use uuid::Uuid;

use crate::core::process_transaction;
use crate::error::{CoreCloudError, Result};
use crate::multiplayer::{
    connect, enter_room, get_transactions, leave_room, send_heartbeat, send_transaction,
};

fn to_transaction_server(transaction: ReceiveTransaction) -> TransactionServer {
    TransactionServer {
        id: Uuid::parse_str(&transaction.id).unwrap(),
        file_id: Uuid::parse_str(&transaction.file_id).unwrap(),
        operations: transaction.operations,
        sequence_num: transaction.sequence_num,
    }
}

/// Status of the worker.
///
/// It is used to track if the worker has received the catchup transactions,
/// the transaction ack, and the room entry confirmation.
#[derive(Debug)]
pub struct WorkerStatus {
    received_enter_room: bool,
    received_catchup_transactions: bool,
    received_transaction_ack: bool,
    enter_room_notify: Arc<Notify>,
    catchup_notify: Arc<Notify>,
}

impl Default for WorkerStatus {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkerStatus {
    pub fn new() -> Self {
        Self {
            received_enter_room: false,
            received_catchup_transactions: false,
            received_transaction_ack: false,
            enter_room_notify: Arc::new(Notify::new()),
            catchup_notify: Arc::new(Notify::new()),
        }
    }

    pub fn is_complete(&self) -> bool {
        self.received_catchup_transactions && self.received_transaction_ack
    }
}

/// Cloud Worker
///
/// Usage:
///
/// ```rust
/// // create worker
/// // load file
/// // establish ws connection
/// // send EnterRoom message
/// let worker = Worker::new(file_id, sequence_num, presigned_url, m2m_auth_token).await?;
///
/// // receive catchup transactions
/// // receive room transactions
///
/// // process operations
/// worker.process_operations(operations).await?;
///
/// // wait for TransactionAck of sent transaction
/// while !worker.status.is_complete() {
///     tokio::time::sleep(Duration::from_secs(1)).await;
/// }
/// ```
///
/// * `file_id` - The ID of the file to process.
/// * `sequence_num` - The sequence number of the file to process.
/// * `session_id` - The session ID of the worker.
/// * `file` - The file to process.
/// * `transaction_id` - The ID of the transaction to process.
/// * `m2m_auth_token` - The M2M auth token to use for the worker.
/// * `websocket_sender` - The websocket sender to use for the worker.
/// * `websocket_receiver` - The websocket receiver to use for the worker.
/// * `websocket_receiver_handle` - The websocket receiver handle to use for the worker.
/// * `status` - The status of the worker.
pub struct Worker {
    pub(crate) file_id: Uuid,
    pub(crate) sequence_num: u64,
    pub(crate) session_id: Uuid,
    pub(crate) file: Arc<Mutex<GridController>>,
    pub(crate) transaction_id: Arc<Mutex<Option<Uuid>>>,
    pub(crate) m2m_auth_token: String,
    pub(crate) multiplayer_url: String,
    pub(crate) websocket_sender: Option<Arc<Mutex<WebSocketSender>>>,
    pub(crate) websocket_receiver: Option<Arc<Mutex<WebSocketReceiver>>>,
    pub(crate) websocket_receiver_handle: Option<JoinHandle<()>>,
    pub(crate) heartbeat_handle: Option<JoinHandle<()>>,
    pub status: Arc<Mutex<WorkerStatus>>,
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
    /// Create a new worker.
    ///
    /// This will create a new worker and connect to the multiplayer server.
    /// It will then enter the room and get the catchup transactions.
    ///
    /// * `file_id` - The ID of the file to process.
    /// * `sequence_num` - The sequence number of the file to process.
    /// * `presigned_url` - The presigned URL of the file to process.
    /// * `m2m_auth_token` - The M2M auth token to use for the worker.
    /// * `multiplayer_url` - The URL of the multiplayer websocket server.
    ///
    /// Returns a new worker.
    pub async fn new(
        file_id: Uuid,
        sequence_num: u64,
        presigned_url: &str,
        m2m_auth_token: String,
        multiplayer_url: String,
    ) -> Result<Self> {
        tracing::info!("📂 [Worker] Loading file {} from presigned URL", file_id);
        let file = Self::load_file(file_id, sequence_num, presigned_url).await?;
        tracing::info!("✅ [Worker] File loaded successfully");

        let session_id = Uuid::new_v4();
        let mut worker = Worker {
            file_id,
            sequence_num,
            session_id,
            file: Arc::new(Mutex::new(file)),
            m2m_auth_token,
            multiplayer_url,
            transaction_id: Arc::new(Mutex::new(None)),
            websocket_sender: None,
            websocket_receiver: None,
            websocket_receiver_handle: None,
            heartbeat_handle: None,
            status: Arc::new(Mutex::new(WorkerStatus::new())),
        };

        // first, connect to the multiplayer server
        tracing::info!("🔌 [Worker] Connecting to multiplayer server");
        worker.connect().await?;
        tracing::info!("✅ [Worker] Connected to multiplayer");

        let enter_room_notify = Arc::clone(&worker.status.lock().await.enter_room_notify);
        let catchup_notify = Arc::clone(&worker.status.lock().await.catchup_notify);

        let enter_room_notified = enter_room_notify.notified();
        let catchup_notified = catchup_notify.notified();

        // then, enter the room
        tracing::info!("🚪 [Worker] Entering room for file {}", file_id);
        worker.enter_room(file_id).await?;

        // Wait for EnterRoom response from server before proceeding
        // This ensures the multiplayer server has registered our session
        tracing::info!("⏳ [Worker] Waiting for EnterRoom confirmation...");
        enter_room_notified.await;
        tracing::info!("✅ [Worker] Entered room confirmed");

        // finally, get the catchup transactions
        // Request transactions starting from sequence_num + 1 since the loaded file
        // already contains all transactions up to and including sequence_num
        tracing::info!(
            "📥 [Worker] Requesting catchup transactions from sequence {}",
            sequence_num + 1
        );
        worker
            .get_transactions(file_id, worker.session_id, worker.sequence_num + 1)
            .await?;

        // Wait for catchup transactions to be received before proceeding
        // This ensures we don't have a race condition on the first run
        tracing::info!("⏳ [Worker] Waiting for catchup transactions...");
        catchup_notified.await;
        tracing::info!("✅ [Worker] Catchup transactions received");

        // in a separate thread, send heartbeat messages every 10 seconds
        if let Some(sender) = &worker.websocket_sender {
            let sender = Arc::clone(sender);
            let session_id = worker.session_id;
            let file_id = worker.file_id;

            let heartbeat_handle = tokio::spawn(async move {
                loop {
                    if let Err(e) =
                        send_heartbeat(&mut *sender.lock().await, session_id, file_id).await
                    {
                        tracing::error!("Error sending heartbeat: {e}");
                        break; // Exit if we can't send heartbeat
                    }
                    tokio::time::sleep(Duration::from_secs(10)).await;
                }
            });
            worker.heartbeat_handle = Some(heartbeat_handle);
        }

        Ok(worker)
    }

    /// Load a file from a presigned URL.
    async fn load_file(
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
    ///
    /// This will connect to the multiplayer server and create a new websocket
    /// sender and receiver.
    async fn connect(&mut self) -> Result<()> {
        if !self.is_connected() {
            let (websocket, _response) =
                connect(&self.multiplayer_url, &self.m2m_auth_token).await?;
            let (sender, receiver) = websocket.split();

            self.websocket_sender = Some(Arc::new(Mutex::new(sender)));
            self.websocket_receiver = Some(Arc::new(Mutex::new(receiver)));

            self.listen_for_messages().await?;
        }

        Ok(())
    }

    /// Listen for messages from the multiplayer server.
    ///
    /// This will listen for messages from the multiplayer server and process them.
    /// Important messages are:
    /// - TransactionAck (text)
    /// - BinaryTransactions (binary)
    /// - BinaryTransaction (binary)
    /// - Close
    /// - Error
    ///
    /// Returns Ok(()) if the messages are processed successfully.
    async fn listen_for_messages(&mut self) -> Result<()> {
        // listen for messages in a separate thread
        if let Some(receiver) = self.websocket_receiver.as_ref().cloned() {
            let file = Arc::clone(&self.file);
            let status = Arc::clone(&self.status);
            let transaction_id = Arc::clone(&self.transaction_id);
            let print_error = |e| println!("Error parsing message from multiplayer: {e}");

            self.websocket_receiver_handle = Some(tokio::spawn(async move {
                while let Some(message) = receiver.lock().await.stream.next().await {
                    match message {
                        Ok(WebsocketMessage::Text(text)) => {
                            match serde_json::from_str(&text) {
                                Ok(message) => match message {
                                    MessageResponse::TransactionAck { id, .. } => {
                                        if Some(id) == *transaction_id.lock().await {
                                            status.lock().await.received_transaction_ack = true;
                                        }
                                    }
                                    MessageResponse::EnterRoom {
                                        file_id: room_file_id,
                                        sequence_num: room_seq,
                                    } => {
                                        tracing::info!(
                                            "📨 [Worker] Received EnterRoom confirmation for file {} at sequence {}",
                                            room_file_id,
                                            room_seq
                                        );
                                        let mut status_lock = status.lock().await;
                                        status_lock.received_enter_room = true;
                                        status_lock.enter_room_notify.notify_one();
                                    }
                                    // TODO(ddimaria): keep a count of users in the room
                                    MessageResponse::UsersInRoom { .. } => {}
                                    // Handle error responses - if we get an error about missing transactions,
                                    // it likely means we're already at the latest sequence and there are no
                                    // catchup transactions to receive
                                    MessageResponse::Error { .. } => {
                                        let mut status_lock = status.lock().await;
                                        status_lock.received_catchup_transactions = true;
                                        status_lock.catchup_notify.notify_one();
                                    }
                                    // we don't care about other messages
                                    _ => {}
                                },
                                Err(e) => print_error(e.to_string()),
                            }
                        }
                        Ok(WebsocketMessage::Binary(binary)) => {
                            if let Ok(type_name) = type_name_from_peek(&binary) {
                                match type_name.as_str() {
                                    "BinaryTransactions" => {
                                        match ReceiveTransactions::decode(binary) {
                                            Ok(receive_transactions) => {
                                                // convert ReceiveTransactions to TransactionServer
                                                let transactions = receive_transactions
                                                    .transactions
                                                    .into_iter()
                                                    .map(to_transaction_server)
                                                    .collect::<Vec<TransactionServer>>();

                                                // apply transactions to the file
                                                file.lock()
                                                    .await
                                                    .received_transactions(transactions);

                                                // update status
                                                let mut status_lock = status.lock().await;
                                                status_lock.received_catchup_transactions = true;
                                                status_lock.catchup_notify.notify_one();
                                            }
                                            Err(e) => print_error(e.to_string()),
                                        };
                                    }
                                    "BinaryTransaction" => {
                                        match ReceiveTransaction::decode(binary) {
                                            Ok(transaction) => {
                                                // convert ReceiveTransactions to TransactionServer
                                                let transaction_server =
                                                    to_transaction_server(transaction);

                                                file.lock().await.received_transactions(vec![
                                                    transaction_server,
                                                ]);
                                            }
                                            Err(e) => print_error(e.to_string()),
                                        };
                                    }
                                    // we don't care about other messages
                                    _ => {}
                                }
                            }
                        }
                        Ok(WebsocketMessage::Close(_)) => {
                            tracing::info!("WebSocket closed normally");
                            break;
                        }
                        Ok(_) => {}
                        Err(e) => {
                            // Only log non-shutdown errors
                            if !e.to_string().contains("ResetWithoutClosingHandshake") {
                                tracing::warn!("WebSocket error: {:?}", e);
                            }
                            break;
                        }
                    }
                }
            }));
        }

        Ok(())
    }

    /// Check if the worker is connected to the multiplayer websocket.
    fn is_connected(&self) -> bool {
        self.websocket_sender.is_some() && self.websocket_receiver.is_some()
    }

    /// Enter the room for a given file.
    ///
    /// This will connect to the multiplayer server and enter the room for the
    /// given file.
    /// Returns true if the worker is new, false if it already exists.
    async fn enter_room(&mut self, file_id: Uuid) -> Result<()> {
        if let Some(sender) = self.websocket_sender.as_mut() {
            let user_id = Uuid::new_v4();
            enter_room(&mut *sender.lock().await, user_id, file_id, self.session_id).await?;

            tracing::info!("Entered room {file_id}");
        }

        Ok(())
    }

    /// Get transactions from the multiplayer server.
    async fn get_transactions(
        &mut self,
        file_id: Uuid,
        session_id: Uuid,
        min_sequence_num: u64,
    ) -> Result<()> {
        if let Some(sender) = self.websocket_sender.as_mut() {
            get_transactions(
                &mut *sender.lock().await,
                file_id,
                session_id,
                min_sequence_num + 1,
            )
            .await?;
        }

        Ok(())
    }

    /// Process an operation.
    /// This will create a pending transaction and apply it to the file.
    pub async fn process_operations(
        &mut self,
        binary_ops: Vec<u8>,
        // team_id: Uuid,
        team_id: String,
        token: String,
    ) -> Result<()> {
        tracing::info!("🔄 [Worker] Deserializing operations");
        let operations = Transaction::decompress_and_deserialize::<Vec<Operation>>(&binary_ops)
            .map_err(|e| CoreCloudError::Serialization(e.to_string()))?;

        tracing::info!("⚙️  [Worker] Processing {} operation(s)", operations.len());

        // Log what operations we're executing
        for op in &operations {
            match op {
                Operation::ComputeCode { sheet_pos } => {
                    tracing::info!(
                        "🔧 [Worker] Executing code at position {}:{}",
                        sheet_pos.x,
                        sheet_pos.y
                    );
                }
                Operation::ComputeCodeSelection { selection } => {
                    tracing::info!("🔧 [Worker] Executing code selection: {:?}", selection);
                }
                _ => {}
            }
        }

        let transaction_id = process_transaction(
            Arc::clone(&self.file),
            operations,
            None,
            TransactionName::Unknown,
            team_id,
            token,
        )
        .await?;

        *self.transaction_id.lock().await = Some(transaction_id);

        // Log any code execution output and get forward transaction
        let (forward_ops, execution_logs) = {
            let file_lock = self.file.lock().await;
            let forward_transaction = file_lock.last_transaction().unwrap();

            // Collect execution logs
            let mut logs = Vec::new();
            for op in &forward_transaction.operations {
                if let Operation::SetDataTable {
                    sheet_pos,
                    data_table: Some(dt),
                    ..
                } = op
                {
                    if let quadratic_core::grid::DataTableKind::CodeRun(code_run) = &dt.kind {
                        let pos_str = format!("{}:{}", sheet_pos.x, sheet_pos.y);

                        if let Some(std_out) = &code_run.std_out {
                            if !std_out.trim().is_empty() {
                                logs.push(("output", pos_str.clone(), std_out.trim().to_string()));
                            }
                        }
                        if let Some(std_err) = &code_run.std_err {
                            if !std_err.trim().is_empty() {
                                logs.push(("stderr", pos_str.clone(), std_err.trim().to_string()));
                            }
                        }
                        if let Some(error) = &code_run.error {
                            logs.push(("error", pos_str.clone(), error.to_string()));
                        }
                        if code_run.error.is_none() {
                            if let Some(return_type) = &code_run.return_type {
                                logs.push(("result", pos_str.clone(), return_type.clone()));
                            }
                        }
                    }
                }
            }

            (forward_transaction.operations.to_owned(), logs)
        };

        // Log outside the lock
        for (log_type, pos, message) in execution_logs {
            match log_type {
                "output" => tracing::info!("📤 [Worker Output {}] {}", pos, message),
                "stderr" => tracing::warn!("⚠️  [Worker StdErr {}] {}", pos, message),
                "error" => tracing::error!("❌ [Worker Error {}] {}", pos, message),
                "result" => tracing::info!("✨ [Worker Result {}] {}", pos, message),
                _ => {}
            }
        }

        tracing::info!(
            "📡 [Worker] Sending transaction {} to multiplayer",
            transaction_id
        );
        if let Some(sender) = self.websocket_sender.as_mut() {
            send_transaction(
                &mut *sender.lock().await,
                transaction_id,
                self.file_id,
                self.session_id,
                forward_ops,
            )
            .await?;
        }
        tracing::info!("✅ [Worker] Transaction sent");

        Ok(())
    }

    /// Leave the room for a given file.
    pub async fn leave_room(&mut self) -> Result<()> {
        // First, abort the heartbeat task to prevent it from trying to send after closing
        if let Some(handle) = &self.heartbeat_handle {
            handle.abort();
        }

        // Then send the leave room message and close the connection
        if let Some(sender) = self.websocket_sender.as_mut() {
            let mut sender_lock = sender.lock().await;

            // Send leave room message (ignore errors if room already gone)
            let _ = leave_room(&mut *sender_lock, self.session_id, self.file_id).await;

            // Close the WebSocket connection gracefully
            let _ = sender_lock.close().await;
        }

        // Abort the receiver task if it's still running
        if let Some(handle) = &self.websocket_receiver_handle {
            handle.abort();
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::new_storage;

    use super::*;

    use quadratic_core::{SheetPos, grid::SheetId};
    use quadratic_rust_shared::storage::Storage;
    use std::{str::FromStr, time::Duration};

    #[tokio::test]
    async fn test_worker_startup() {
        let file_id = Uuid::parse_str("d87f4037-fb48-4b6e-abf0-178c725e464d").unwrap();
        let sheet_id = SheetId::from_str("b8718a71-e4b1-49bb-8f32-f0d931850cfd").unwrap();
        let storage = new_storage();
        let sequence_num = 77;
        let full_file_url = format!("{file_id}-{sequence_num}.grid");
        let presigned_url = storage.presigned_url(&full_file_url).await.unwrap();
        let team_id = "test_team_id".to_string();
        let m2m_auth_token = "M2M_AUTH_TOKEN".to_string();

        let sheet_pos = SheetPos::new(sheet_id, 1, 1);
        let operations = vec![Operation::ComputeCode { sheet_pos }];
        let binary_ops = Transaction::serialize_and_compress(&operations).unwrap();

        // emulate a browser worker
        let mut browser_worker = Worker::new(
            file_id,
            sequence_num,
            &presigned_url,
            m2m_auth_token.clone(),
            "ws://localhost:3001/ws".to_string(),
        )
        .await
        .unwrap();

        // send a transaction to the server so that worker_1 gets a catchup transaction message
        browser_worker
            .process_operations(binary_ops.clone(), team_id.clone(), m2m_auth_token.clone())
            .await
            .unwrap();

        // wait 2 seconds so that there is a catchup transaction message
        tokio::time::sleep(Duration::from_secs(2)).await;

        // cloud worker
        let mut cloud_worker = Worker::new(
            file_id,
            sequence_num,
            &presigned_url,
            m2m_auth_token.clone(),
            "ws://localhost:3001/ws".to_string(),
        )
        .await
        .unwrap();

        cloud_worker
            .process_operations(binary_ops, team_id, m2m_auth_token)
            .await
            .unwrap();

        while !cloud_worker.status.lock().await.is_complete() {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    }
}
