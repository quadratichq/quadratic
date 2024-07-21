use serde::Serialize;
use std::fmt::Display;
use tokio::time::Instant;

#[derive(Debug, Default)]
pub(crate) struct Stats {
    pub(crate) last_query_time: Option<Instant>,
}

#[derive(Debug, Default, Serialize)]
pub(crate) struct StatsResponse {
    pub(crate) last_processed_query: String,
}

impl Display for Stats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let last_processed_query = match self.last_query_time {
            Some(time) => format!("{:?} seconds ago", time.elapsed().as_secs()),
            None => "No queries processed yet".to_string(),
        };

        let stats = StatsResponse {
            last_processed_query,
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
