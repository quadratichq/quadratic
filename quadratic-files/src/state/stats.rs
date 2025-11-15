use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fmt::Display;

#[derive(Debug, Default, Clone)]
pub(crate) struct Stats {
    pub(crate) last_processed_file_time: Option<DateTime<Utc>>,
    pub(crate) files_to_process_in_pubsub: u64,
    pub(crate) channels_to_truncate_in_pubsub: u64,
    pub(crate) last_truncated_transaction_time: Option<DateTime<Utc>>,
    pub(crate) num_connections_processing: u64,
}

#[derive(Debug, Default, Serialize)]
pub(crate) struct StatsResponse {
    pub(crate) last_processed_file_time: String,
    pub(crate) last_processed_file_elapsed: String,
    pub(crate) files_to_process_in_pubsub: u64,
    pub(crate) last_truncated_transaction_time: String,
    pub(crate) last_truncated_transaction_elapsed: String,
    pub(crate) channels_to_truncate_in_pubsub: u64,
    pub(crate) num_connections_processing: u64,
}

impl From<&Stats> for StatsResponse {
    fn from(stats: &Stats) -> Self {
        let last_processed_file_elapsed = ago(stats.last_processed_file_time, "files");
        let last_truncated_transaction_elapsed =
            ago(stats.last_truncated_transaction_time, "transactions");
        let to_rfc3339 =
            |time: Option<DateTime<Utc>>| time.map(|t| t.to_rfc3339()).unwrap_or_default();

        StatsResponse {
            last_processed_file_time: to_rfc3339(stats.last_processed_file_time),
            last_processed_file_elapsed,
            files_to_process_in_pubsub: stats.files_to_process_in_pubsub,
            last_truncated_transaction_time: to_rfc3339(stats.last_truncated_transaction_time),
            last_truncated_transaction_elapsed,
            channels_to_truncate_in_pubsub: stats.channels_to_truncate_in_pubsub,
            num_connections_processing: stats.num_connections_processing,
        }
    }
}

fn ago(time: Option<DateTime<Utc>>, kind: &str) -> String {
    match time {
        Some(time) => format!("{:?} seconds ago", (Utc::now() - time).num_seconds()),
        None => format!("No {kind} processed yet"),
    }
}

impl Display for Stats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let stats = StatsResponse::from(self);

        write!(
            f,
            "{}",
            serde_json::to_string(&stats).map_err(|_| std::fmt::Error)?
        )
    }
}

impl Stats {
    pub(crate) fn new() -> Self {
        Stats::default()
    }
}
