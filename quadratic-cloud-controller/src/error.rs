use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use quadratic_rust_shared::clean_errors;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, ControllerError>;

#[derive(Error, Debug)]
pub(crate) enum ControllerError {
    #[error("Error acknowledging tasks: {0}")]
    AckTasks(String),

    #[error("Client error: {0}")]
    Client(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Docker error: {0}")]
    Docker(String),

    #[error("Error getting tasks for worker: {0}")]
    GetTasksForWorker(String),

    #[error("Header error: {0}")]
    Header(String),

    #[error("PubSub error: {0}")]
    PubSub(String),

    #[error("{0}: {1}")]
    QuadraticApi(String, String),

    #[error("Error getting scheduled tasks: {0}")]
    ScheduledTaskWatcher(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("Settings error: {0}")]
    Settings(String),

    #[error("Error shutting down worker: {0}")]
    ShutdownWorker(String),

    #[error("Error starting server: {0}")]
    StartServer(String),

    #[error("Error with Uuid: {0}")]
    Uuid(String),

    #[error("Worker access token error: {0}")]
    WorkerAccessToken(String),

    #[error("Worker ephemeral token error: {0}")]
    WorkerEphemeralToken(String),
}

impl From<ControllerError> for String {
    fn from(error: ControllerError) -> Self {
        error.to_string()
    }
}

impl IntoResponse for ControllerError {
    fn into_response(self) -> Response {
        let (status, error) = match &self {
            ControllerError::WorkerEphemeralToken(error) => {
                (StatusCode::UNAUTHORIZED, clean_errors(error))
            }
            ControllerError::GetTasksForWorker(error) => {
                (StatusCode::BAD_REQUEST, clean_errors(error))
            }
            ControllerError::Header(error) => (StatusCode::BAD_REQUEST, clean_errors(error)),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "Unknown".into()),
        };

        tracing::warn!("{} {}: {:?}", status, error, self);

        (status, error).into_response()
    }
}

pub(crate) fn log_error_only<T>(result: Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(e) => {
            tracing::error!("Error: {e}");
            Err(e)
        }
    }
}

impl From<uuid::Error> for ControllerError {
    fn from(error: uuid::Error) -> Self {
        ControllerError::Uuid(error.to_string())
    }
}

impl From<serde_json::Error> for ControllerError {
    fn from(error: serde_json::Error) -> Self {
        ControllerError::Serialization(error.to_string())
    }
}
