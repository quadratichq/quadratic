//! Synced Connection Cache
//!
//! Cache synced connection to avoid duplicate requests.

use quadratic_rust_shared::cache::{Cache as CacheTrait, memory::MemoryCache};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

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
pub(crate) struct SyncedConnectionCache {
    pub(crate) synced_connection:
        Arc<Mutex<MemoryCache<Uuid, (SyncedConnectionKind, SyncedConnectionStatus)>>>,
}

impl SyncedConnectionCache {
    /// Create a new cache
    pub(crate) fn new() -> Self {
        Self {
            synced_connection: Arc::new(Mutex::new(MemoryCache::new())),
        }
    }

    /// Get a status from the cache.
    /// If the status is not found or expired, None is returned.
    pub(crate) async fn get(
        &self,
        uuid: Uuid,
    ) -> Option<(SyncedConnectionKind, SyncedConnectionStatus)> {
        (*self.synced_connection.lock().await)
            .get(&uuid)
            .await
            .cloned()
    }

    /// Get or create a status from the cache.
    pub(crate) async fn get_or_create(
        &self,
        uuid: Uuid,
        kind: SyncedConnectionKind,
        status: SyncedConnectionStatus,
    ) -> Option<(SyncedConnectionKind, SyncedConnectionStatus)> {
        (*self.synced_connection.lock().await)
            .get_or_create(&uuid, (kind, status), None)
            .await
            .cloned()
    }

    /// Add a status to the cache
    pub(crate) async fn add(
        &self,
        uuid: Uuid,
        kind: SyncedConnectionKind,
        status: SyncedConnectionStatus,
    ) {
        (*self.synced_connection.lock().await)
            .create(&uuid, (kind, status), None)
            .await;
    }

    /// Update a status in the cache
    pub(crate) async fn update(
        &self,
        uuid: Uuid,
        kind: SyncedConnectionKind,
        status: SyncedConnectionStatus,
    ) {
        let existing = self.get_or_create(uuid, kind.clone(), status.clone()).await;

        if let Some((existing_kind, _)) = existing {
            (*self.synced_connection.lock().await)
                .update(&uuid, (existing_kind, status))
                .await;
        }
    }

    /// Remove a status from the cache
    pub(crate) async fn delete(
        &self,
        uuid: Uuid,
    ) -> Option<(SyncedConnectionKind, SyncedConnectionStatus)> {
        (*self.synced_connection.lock().await).delete(&uuid).await
    }
}
