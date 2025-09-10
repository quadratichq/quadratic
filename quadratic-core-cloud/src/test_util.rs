use quadratic_core::controller::GridController;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::worker::Worker;

pub(crate) async fn setup() -> Arc<Mutex<Worker>> {
    let worker = Worker {
        file_id: Uuid::new_v4(),
        sequence_num: 0,
        session_id: Uuid::new_v4(),
        file: Arc::new(Mutex::new(GridController::test())),
        m2m_auth_token: "M2M_AUTH_TOKEN".to_string(),
        websocket_sender: None,
        websocket_receiver: None,
    };
    let worker = Arc::new(Mutex::new(worker));

    worker
}
