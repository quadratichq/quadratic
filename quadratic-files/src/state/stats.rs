use serde::Serialize;
use std::fmt::Display;
use tokio::time::Instant;

#[derive(Debug, Default)]
pub(crate) struct Stats {
    pub(crate) last_processed_file_time: Option<Instant>,
    pub(crate) files_to_process_in_pubsub: u64,
}

#[derive(Debug, Default, Serialize)]
pub(crate) struct StatsResponse {
    pub(crate) last_processed_file: String,
    pub(crate) files_to_process_in_pubsub: u64,
}

impl Display for Stats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let last_processed_file = match self.last_processed_file_time {
            Some(time) => format!("{:?} seconds ago", time.elapsed().as_secs()),
            None => "No files processed yet".to_string(),
        };

        let stats = StatsResponse {
            last_processed_file,
            files_to_process_in_pubsub: self.files_to_process_in_pubsub,
        };

        write!(f, "{}", serde_json::to_string(&stats).unwrap())
    }
}

impl Stats {
    pub(crate) fn new() -> Self {
        Stats::default()
    }
}
