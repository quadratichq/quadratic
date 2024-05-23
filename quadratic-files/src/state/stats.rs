use serde::Serialize;
use std::fmt::Display;
use tokio::time::Instant;

#[derive(Debug, Default)]
pub(crate) struct Stats {
    pub(crate) last_processed_file_time: Option<Instant>,
    pub(crate) files_to_process_in_pubsub: u64,
    pub(crate) channels_to_truncate_in_pubsub: u64,
    pub(crate) last_truncated_transaction_time: Option<Instant>,
}

#[derive(Debug, Default, Serialize)]
pub(crate) struct StatsResponse {
    pub(crate) last_processed_file: String,
    pub(crate) files_to_process_in_pubsub: u64,
    pub(crate) last_processed_transaction: String,
    pub(crate) channels_to_truncate_in_pubsub: u64,
}

fn ago(time: Option<Instant>, kind: &str) -> String {
    match time {
        Some(time) => format!("{:?} seconds ago", time.elapsed().as_secs()),
        None => format!("No {kind} processed yet"),
    }
}

impl Display for Stats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let last_processed_file = ago(self.last_processed_file_time, "files");
        let last_processed_transaction = ago(self.last_truncated_transaction_time, "transactions");

        let stats = StatsResponse {
            last_processed_file,
            files_to_process_in_pubsub: self.files_to_process_in_pubsub,
            last_processed_transaction,
            channels_to_truncate_in_pubsub: self.channels_to_truncate_in_pubsub,
        };

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
