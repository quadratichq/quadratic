use thiserror::Error;

#[derive(Error, Debug)]
pub(crate) enum WorkerError {
    #[error("Config error: {0}")]
    Config(String),

    #[error("State error: {0}")]
    State(String),
}
