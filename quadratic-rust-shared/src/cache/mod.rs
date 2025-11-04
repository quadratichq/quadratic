use async_trait::async_trait;
use std::time::{Duration, Instant};

pub mod error;
#[cfg(feature = "memory")]
pub mod memory;

#[async_trait]
pub trait Cache<'a, K, V> {
    // Get all keys in the cache
    async fn keys(&self) -> Vec<&K>;

    // Create a value in the cache
    ///
    /// If the key already exists, the value is overwritten and the old value is returned.
    async fn create(&mut self, key: &K, value: V, duration: Option<Duration>) -> Option<V>;

    // Get a value from the cache
    ///
    /// Returns `None` if the key does not exist.
    async fn get(&self, key: &K) -> Option<&V>;

    // Get a mutable reference to a value in the cache
    ///
    /// Returns `None` if the key does not exist.
    async fn get_mut(&mut self, key: &K) -> Option<&mut V>;

    // Get a value from the cache or create it if it doesn't exist
    ///
    /// If the key already exists, the value is returned.
    /// If the key does not exist, the value is created and returned.
    async fn get_or_create(&mut self, key: &K, value: V, duration: Option<Duration>) -> Option<&V>;

    // Update a value in the cache
    ///
    /// If the key does not exist, the None is returned.
    async fn update(&mut self, key: &K, value: V) -> Option<&mut V>;

    // Delete a value from the cache
    ///
    /// Returns `None` if the key does not exist.
    async fn delete(&mut self, key: &K) -> Option<V>;

    // Clear the cache
    async fn flush(&mut self);

    // Check if a value is expired
    ///
    /// Returns `None` if the key does not exist or if expiration is not set.
    async fn is_expired(&self, key: &K) -> Option<bool>;

    // Set the expiration time of a value
    ///
    /// If the key does not exist, the value is created and the expiration time is set.
    async fn set_expires(&mut self, key: &K, duration: Option<Duration>);

    // Convert a duration to an expiration time
    fn duration_to_expires(duration: Duration) -> Instant {
        Instant::now() + duration
    }
}
