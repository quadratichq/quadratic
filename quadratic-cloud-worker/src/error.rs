use thiserror::Error;

pub type Result<T> = std::result::Result<T, WorkerError>;

#[derive(Error, Debug, Clone)]
pub(crate) enum WorkerError {
    #[error("Ack tasks error: {0}")]
    AckTasks(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Create worker error: {0}")]
    CreateWorker(String),

    #[error("Get token error: {0}")]
    GetToken(String),

    #[error("Run worker error: {0}")]
    RunWorker(String),

    #[error("Shutdown worker error: {0}")]
    ShutdownWorker(String),

    #[error("WebSocket error: {0}")]
    WebSocket(String),
}
