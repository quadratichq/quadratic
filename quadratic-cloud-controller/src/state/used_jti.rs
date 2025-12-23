//! Worker JTI Store
//!
//! Tracks the current valid JTI for each worker (by file_id).
//! Each worker has exactly one valid JTI at a time. When a worker requests
//! a new token, we validate the current JTI, remove it, and issue a new one.

use dashmap::DashMap;
use uuid::Uuid;

/// Store for tracking the current valid JTI for each worker
#[derive(Debug)]
pub struct WorkerJtiStore {
    /// Maps file_id -> current valid JTI
    file_jtis: DashMap<Uuid, String>,
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
            file_jtis: DashMap::new(),
        }
    }

    /// Register an initial JTI for a worker.
    /// Called when creating a new worker.
    ///
    /// # Arguments
    /// * `file_id` - The file ID the worker is processing
    /// * `jti` - The initial JTI to register
    pub fn register(&self, file_id: Uuid, jti: String) {
        self.file_jtis.insert(file_id, jti);
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
        // Use entry API for atomic check-and-update
        let mut entry = self.file_jtis.get_mut(&file_id)?;
        
        // Check if the provided JTI matches
        if entry.value() != provided_jti {
            return None;
        }

        // Generate new JTI and update
        let new_jti = Uuid::new_v4().to_string();
        *entry = new_jti.clone();
        
        Some(new_jti)
    }

    /// Remove a worker's JTI entry (when worker shuts down)
    pub fn remove(&self, file_id: &Uuid) {
        self.file_jtis.remove(file_id);
    }

    /// Check if a file has a registered JTI
    #[allow(dead_code)]
    pub fn has_jti(&self, file_id: &Uuid) -> bool {
        self.file_jtis.contains_key(file_id)
    }

    /// Get the current JTI for a file (for testing/debugging)
    #[cfg(test)]
    pub fn get_jti(&self, file_id: &Uuid) -> Option<String> {
        self.file_jtis.get(file_id).map(|r| r.value().clone())
    }

    /// Get the number of tracked workers (for monitoring)
    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.file_jtis.len()
    }

    /// Check if the store is empty
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.file_jtis.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_validate() {
        let store = WorkerJtiStore::new();
        let file_id = Uuid::new_v4();
        let initial_jti = "initial-jti-123".to_string();

        // Register initial JTI
        store.register(file_id, initial_jti.clone());
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

        store.register(file_id, initial_jti);

        // Wrong JTI should fail
        assert!(store.validate_and_rotate(file_id, "wrong-jti").is_none());
    }

    #[test]
    fn test_unknown_file_rejected() {
        let store = WorkerJtiStore::new();
        let unknown_file_id = Uuid::new_v4();

        // Unknown file should fail
        assert!(store.validate_and_rotate(unknown_file_id, "any-jti").is_none());
    }

    #[test]
    fn test_remove() {
        let store = WorkerJtiStore::new();
        let file_id = Uuid::new_v4();

        store.register(file_id, "jti-123".to_string());
        assert!(store.has_jti(&file_id));

        store.remove(&file_id);
        assert!(!store.has_jti(&file_id));
    }

    #[test]
    fn test_multiple_workers() {
        let store = WorkerJtiStore::new();
        let file_id_1 = Uuid::new_v4();
        let file_id_2 = Uuid::new_v4();

        store.register(file_id_1, "jti-1".to_string());
        store.register(file_id_2, "jti-2".to_string());

        assert_eq!(store.len(), 2);

        // Each worker has independent JTI
        assert!(store.validate_and_rotate(file_id_1, "jti-1").is_some());
        assert!(store.validate_and_rotate(file_id_2, "jti-2").is_some());
    }
}

