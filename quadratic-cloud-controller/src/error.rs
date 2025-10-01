use thiserror::Error;

#[derive(Error, Debug)]
pub(crate) enum ControllerError {
    #[error("Config error: {0}")]
    Config(String),

    #[error("Internal server error: {0}")]
    InternalServer(String),
}
