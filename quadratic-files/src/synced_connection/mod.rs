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

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum SyncKind {
    Daily,
    Full,
}
