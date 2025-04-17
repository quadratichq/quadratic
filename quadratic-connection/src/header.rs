use axum::http::{HeaderValue, header};
use http::{HeaderMap, HeaderName};
use tokio::time::Instant;
use uuid::Uuid;

use crate::error::{ConnectionError, Result, header_error};

pub fn time_header(time: Instant) -> HeaderValue {
    header::HeaderValue::from_str(&time.elapsed().as_millis().to_string())
        .unwrap_or(header::HeaderValue::from_static(""))
}

pub fn number_header(number: impl ToString) -> HeaderValue {
    number
        .to_string()
        .parse()
        .unwrap_or(header::HeaderValue::from_static(""))
}

/// Get the team id from the header
pub fn get_team_id_header(headers: &HeaderMap) -> Result<Uuid> {
    let team_id = headers
        .get(HeaderName::from_static("x-team-id"))
        .ok_or_else(|| header_error("Missing x-team-id header"))?
        .to_str()
        .map_err(header_error)?;

    Uuid::parse_str(team_id).map_err(header_error)
}
