use tokio::time::Instant;

#[derive(Debug, Default)]
pub(crate) struct Stats {
    pub(crate) last_processed_file_time: Option<Instant>,
}

impl Stats {
    pub(crate) async fn new() -> Self {
        Stats::default()
    }
}
