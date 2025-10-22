use chrono::NaiveDate;

pub(crate) mod background_workers;
pub(crate) mod cache;
pub(crate) mod mixpanel;

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub(crate) enum SyncedConnectionKind {
    Mixpanel,
}

#[derive(Debug, Clone)]
pub(crate) enum SyncedConnectionStatus {
    Setup,
    ApiRequest,
    Upload,
}

#[derive(Debug, Clone)]
pub(crate) struct DateRange {
    pub(crate) start_date: NaiveDate,
    pub(crate) end_date: NaiveDate,
}

impl DateRange {
    pub(crate) fn new(start_date: NaiveDate, end_date: NaiveDate) -> Self {
        Self {
            start_date,
            end_date,
        }
    }
}
