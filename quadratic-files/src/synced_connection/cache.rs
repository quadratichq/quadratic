//! Synced Connection Cache
//!
//! Cache synced connection to avoid duplicate requests.

use chrono::NaiveDate;
use quadratic_rust_shared::cache::{Cache as CacheTrait, memory::MemoryCache};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::synced_connection::{SyncedConnectionKind, SyncedConnectionStatus};

#[derive(Debug, Clone)]
pub(crate) struct SyncedConnectionCache {
    pub(crate) synced_connection:
        Arc<Mutex<MemoryCache<Uuid, (SyncedConnectionKind, SyncedConnectionStatus)>>>,
    pub(crate) synced_connection_dates: Arc<Mutex<MemoryCache<Uuid, Vec<NaiveDate>>>>,
}

impl SyncedConnectionCache {
    /// Create a new cache
    pub(crate) fn new() -> Self {
        Self {
            synced_connection: Arc::new(Mutex::new(MemoryCache::new())),
            synced_connection_dates: Arc::new(Mutex::new(MemoryCache::new())),
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

    /// Add a date to the cache
    pub(crate) async fn add_date(&self, uuid: Uuid, date: NaiveDate) {
        let mut dates = self.get_dates(uuid).await;

        if dates.contains(&date) {
            return;
        }

        dates.push(date);

        (*self.synced_connection_dates.lock().await)
            .create(&uuid, dates, None)
            .await;
    }

    /// Get the dates from the cache
    pub(crate) async fn get_dates(&self, uuid: Uuid) -> Vec<NaiveDate> {
        (*self.synced_connection_dates.lock().await)
            .get(&uuid)
            .await
            .cloned()
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::task::JoinSet;

    const KIND: SyncedConnectionKind = SyncedConnectionKind::Mixpanel;
    const STATUS: SyncedConnectionStatus = SyncedConnectionStatus::Setup;
    const STATUS_2: SyncedConnectionStatus = SyncedConnectionStatus::ApiRequest;

    fn assert_matches(kind: SyncedConnectionKind, status: SyncedConnectionStatus) {
        assert!(matches!(kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(status, SyncedConnectionStatus::Setup));
    }

    #[tokio::test]
    async fn test_get() {
        let cache = SyncedConnectionCache::new();
        let id = Uuid::new_v4();
        let non_existent_id = Uuid::new_v4();

        let result = cache.get(id).await;
        assert!(result.is_none(),);

        cache.add(id, KIND, STATUS).await;

        let result = cache.get(id).await;
        assert!(result.is_some());

        let (kind, status) = result.unwrap();
        assert_matches(kind, status);

        let result = cache.get(non_existent_id).await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_or_create() {
        let cache = SyncedConnectionCache::new();
        let id = Uuid::new_v4();

        let result = cache.get_or_create(id, KIND, STATUS).await;
        assert!(result.is_some());

        let (kind, status) = result.unwrap();
        assert_matches(kind, status);

        let get_result = cache.get(id).await;
        assert!(get_result.is_some());

        let (get_kind, get_status) = get_result.unwrap();
        assert_matches(get_kind, get_status);

        let result = cache.get_or_create(id, KIND, STATUS).await;
        assert!(result.is_some());

        let (existing_kind, existing_status) = result.unwrap();
        assert_matches(existing_kind, existing_status);
    }

    #[tokio::test]
    async fn test_add() {
        let cache = SyncedConnectionCache::new();
        let id_1 = Uuid::new_v4();
        let id_2 = Uuid::new_v4();

        cache.add(id_1, KIND, STATUS).await;

        let result1 = cache.get(id_1).await;
        assert!(result1.is_some());

        let (kind1, status1) = result1.unwrap();
        assert_matches(kind1, status1);

        cache.add(id_2, KIND, STATUS).await;

        let result2 = cache.get(id_2).await;
        assert!(result2.is_some());

        let (kind2, status2) = result2.unwrap();
        assert_matches(kind2, status2);

        let result1_again = cache.get(id_1).await;
        assert!(result1_again.is_some());
    }

    #[tokio::test]
    async fn test_update() {
        let cache = SyncedConnectionCache::new();
        let id = Uuid::new_v4();

        cache.add(id, KIND, STATUS).await;

        let initial_result = cache.get(id).await;
        assert!(initial_result.is_some());

        let (_, initial_status) = initial_result.unwrap();
        assert_matches(KIND, initial_status);

        cache.update(id, KIND, STATUS_2).await;

        let updated_result = cache.get(id).await;
        assert!(updated_result.is_some());

        let (updated_kind, updated_status) = updated_result.unwrap();
        assert!(matches!(updated_kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(updated_status, SyncedConnectionStatus::ApiRequest));
    }

    #[tokio::test]
    async fn test_delete() {
        let cache = SyncedConnectionCache::new();
        let id = Uuid::new_v4();
        let non_existent_id = Uuid::new_v4();

        let empty_result = cache.delete(non_existent_id).await;
        assert!(empty_result.is_none());

        cache.add(id, KIND, STATUS).await;

        let exists = cache.get(id).await;
        assert!(exists.is_some());

        let delete_result = cache.delete(id).await;
        assert!(delete_result.is_some());

        let (deleted_kind, deleted_status) = delete_result.unwrap();
        assert!(matches!(deleted_kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(deleted_status, SyncedConnectionStatus::Setup));

        let after_delete = cache.get(id).await;
        assert!(after_delete.is_none());

        let double_delete = cache.delete(id).await;
        assert!(double_delete.is_none());
    }

    #[tokio::test]
    async fn test_concurrent_access() {
        let cache = Arc::new(SyncedConnectionCache::new());
        let mut join_set = JoinSet::new();
        let num_tasks = 10;
        let operations_per_task = 20;

        for _task_id in 0..num_tasks {
            let cache_clone = cache.clone();
            join_set.spawn(async move {
                let mut ids = Vec::new();

                for _i in 0..operations_per_task {
                    let id: Uuid = Uuid::new_v4();
                    ids.push(id);
                    cache_clone.add(id, KIND, STATUS).await;
                }

                for uuid in &ids {
                    let result = cache_clone.get(*uuid).await;
                    assert!(result.is_some());
                }

                for (i, uuid) in ids.iter().enumerate() {
                    if i % 2 == 0 {
                        cache_clone.update(*uuid, KIND, STATUS_2).await;
                    }
                }

                let mut deleted_count = 0;
                for (i, uuid) in ids.iter().enumerate() {
                    if i % 2 == 1 {
                        let deleted = cache_clone.delete(*uuid).await;
                        if deleted.is_some() {
                            deleted_count += 1;
                        }
                    }
                }

                deleted_count
            });
        }

        // wait for all tasks to complete
        let mut total_deleted = 0;

        while let Some(result) = join_set.join_next().await {
            match result {
                Ok(deleted_count) => {
                    total_deleted += deleted_count;
                }
                Err(e) => {
                    panic!("Task failed: {:?}", e);
                }
            }
        }

        assert!(total_deleted > 0);

        let id = Uuid::new_v4();
        let mut join_set = JoinSet::new();

        for _ in 0..5 {
            let cache_clone = cache.clone();
            join_set.spawn(async move { cache_clone.get_or_create(id, KIND, STATUS).await });
        }

        let mut success_count = 0;

        while let Some(result) = join_set.join_next().await {
            match result {
                Ok(Some(_)) => success_count += 1,
                Ok(None) => panic!("get_or_create should never return None in normal operation"),
                Err(e) => panic!("Task failed: {:?}", e),
            }
        }

        assert_eq!(success_count, 5);

        let final_result = cache.get(id).await;
        assert!(final_result.is_some());

        let (final_kind, final_status) = final_result.unwrap();
        assert!(matches!(final_kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(final_status, SyncedConnectionStatus::Setup));
    }
}
