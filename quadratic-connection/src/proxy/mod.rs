use crate::error::ConnectionError;

pub(crate) mod auth;
pub(crate) mod browser;
pub(crate) mod server;
mod tunnel;

pub(crate) fn proxy_error(e: impl ToString) -> ConnectionError {
    ConnectionError::Proxy(e.to_string())
}
