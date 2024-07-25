use axum::http::{header, HeaderValue};
use tokio::time::Instant;

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
