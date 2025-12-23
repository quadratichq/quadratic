//! Worker JTI Store
//!
//! Tracks the current valid JTI for each worker (by file_id).
//! Each worker has exactly one valid JTI at a time. When a worker requests
//! a new token, we validate the current JTI, remove it, and issue a new one.
//!
//! Also caches worker metadata (email, team_id) to avoid API calls on token rotation.

use dashmap::{DashMap, Entry};
use uuid::Uuid;

/// Cached data for a worker, stored alongside the JTI
#[derive(Debug, Clone)]
pub struct WorkerData {
    pub jti: String,
    pub email: String,
    pub team_id: Uuid,
}

/// Store for tracking the current valid JTI and cached data for each worker
#[derive(Debug)]
pub struct WorkerJtiStore {
    /// Maps file_id -> worker data (JTI + cached metadata)
    file_data: DashMap<Uuid, WorkerData>,
}

impl Default for WorkerJtiStore {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkerJtiStore {
    /// Create a new empty store
    pub fn new() -> Self {
        Self {
            file_data: DashMap::new(),
        }
    }

    /// Register an initial JTI and worker metadata.
    /// Called when creating a new worker.
    ///
    /// # Arguments
    /// * `file_id` - The file ID the worker is processing
    /// * `jti` - The initial JTI to register
    /// * `email` - The email associated with this worker (cached for token generation)
    /// * `team_id` - The team ID associated with this worker (cached for token generation)
    pub fn register(&self, file_id: Uuid, jti: String, email: String, team_id: Uuid) {
        self.file_data.insert(
            file_id,
            WorkerData {
                jti,
                email,
                team_id,
            },
        );
    }

    /// Validate and consume a JTI, returning a new JTI if valid.
    ///
    /// This atomically:
    /// 1. Checks if the provided JTI matches the stored one for this file
    /// 2. If valid, generates a new JTI
    /// 3. Stores the new JTI and returns it
    ///
    /// # Arguments
    /// * `file_id` - The file ID the worker is processing
    /// * `provided_jti` - The JTI the worker provided
    ///
    /// # Returns
    /// * `Some(new_jti)` - If the provided JTI was valid, returns the new JTI
    /// * `None` - If the provided JTI was invalid or not found
    pub fn validate_and_rotate(&self, file_id: Uuid, provided_jti: &str) -> Option<String> {
        match self.file_data.entry(file_id) {
            Entry::Occupied(mut entry) if entry.get().jti == provided_jti => {
                let new_jti = Uuid::new_v4().to_string();
                entry.get_mut().jti = new_jti.clone();
                Some(new_jti)
            }
            _ => None,
        }
    }

    /// Get the cached worker data for a file (email and team_id for JWT generation)
    pub fn get_worker_data(&self, file_id: &Uuid) -> Option<WorkerData> {
        self.file_data.get(file_id).map(|r| r.value().clone())
    }

    /// Remove a worker's entry (when worker shuts down)
    pub fn remove(&self, file_id: &Uuid) {
        self.file_data.remove(file_id);
    }

    /// Check if a file has a registered entry
    #[allow(dead_code)]
    pub fn has_jti(&self, file_id: &Uuid) -> bool {
        self.file_data.contains_key(file_id)
    }

    /// Get the current JTI for a file (for testing/debugging)
    #[cfg(test)]
    pub fn get_jti(&self, file_id: &Uuid) -> Option<String> {
        self.file_data.get(file_id).map(|r| r.value().jti.clone())
    }

    /// Get the number of tracked workers (for monitoring)
    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.file_data.len()
    }

    /// Check if the store is empty
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.file_data.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_team_id() -> Uuid {
        Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
    }

    #[test]
    fn test_register_and_validate() {
        let store = WorkerJtiStore::new();
        let file_id = Uuid::new_v4();
        let initial_jti = "initial-jti-123".to_string();

        // Register initial JTI with worker data
        store.register(
            file_id,
            initial_jti.clone(),
            "test@example.com".to_string(),
            test_team_id(),
        );
        assert!(store.has_jti(&file_id));
        assert_eq!(store.get_jti(&file_id), Some(initial_jti.clone()));

        // Validate with correct JTI should return new JTI
        let new_jti = store.validate_and_rotate(file_id, &initial_jti);
        assert!(new_jti.is_some());
        let new_jti = new_jti.unwrap();
        assert_ne!(new_jti, initial_jti);

        // Old JTI should no longer work
        assert!(store.validate_and_rotate(file_id, &initial_jti).is_none());

        // New JTI should work
        let newer_jti = store.validate_and_rotate(file_id, &new_jti);
        assert!(newer_jti.is_some());
    }

    #[test]
    fn test_invalid_jti_rejected() {
        let store = WorkerJtiStore::new();
        let file_id = Uuid::new_v4();
        let initial_jti = "initial-jti-123".to_string();

        store.register(
            file_id,
            initial_jti,
            "test@example.com".to_string(),
            test_team_id(),
        );

        // Wrong JTI should fail
        assert!(store.validate_and_rotate(file_id, "wrong-jti").is_none());
    }

    #[test]
    fn test_unknown_file_rejected() {
        let store = WorkerJtiStore::new();
        let unknown_file_id = Uuid::new_v4();

        // Unknown file should fail
        assert!(
            store
                .validate_and_rotate(unknown_file_id, "any-jti")
                .is_none()
        );
    }

    #[test]
    fn test_remove() {
        let store = WorkerJtiStore::new();
        let file_id = Uuid::new_v4();

        store.register(
            file_id,
            "jti-123".to_string(),
            "test@example.com".to_string(),
            test_team_id(),
        );
        assert!(store.has_jti(&file_id));

        store.remove(&file_id);
        assert!(!store.has_jti(&file_id));
    }

    #[test]
    fn test_multiple_workers() {
        let store = WorkerJtiStore::new();
        let file_id_1 = Uuid::new_v4();
        let file_id_2 = Uuid::new_v4();

        store.register(
            file_id_1,
            "jti-1".to_string(),
            "user1@example.com".to_string(),
            test_team_id(),
        );
        store.register(
            file_id_2,
            "jti-2".to_string(),
            "user2@example.com".to_string(),
            test_team_id(),
        );

        assert_eq!(store.len(), 2);

        // Each worker has independent JTI
        assert!(store.validate_and_rotate(file_id_1, "jti-1").is_some());
        assert!(store.validate_and_rotate(file_id_2, "jti-2").is_some());
    }

    #[test]
    fn test_get_worker_data() {
        let store = WorkerJtiStore::new();
        let file_id = Uuid::new_v4();
        let team_id = test_team_id();

        store.register(
            file_id,
            "jti-123".to_string(),
            "test@example.com".to_string(),
            team_id,
        );

        let data = store.get_worker_data(&file_id).unwrap();
        assert_eq!(data.email, "test@example.com");
        assert_eq!(data.team_id, team_id);
        assert_eq!(data.jti, "jti-123");
    }
}
