use thiserror::Error;

pub type Result<T> = std::result::Result<T, WorkerError>;

#[derive(Error, Debug)]
pub(crate) enum WorkerError {
    #[error("Ack tasks error: {0}")]
    AckTasks(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Create worker error: {0}")]
    CreateWorker(String),
}
