use std::collections::HashMap;
use std::fmt::Debug;
use std::hash::Hash;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use crate::cache::Cache;

#[derive(Debug, Clone)]
pub struct MemoryCache<K, V> {
    cache: HashMap<K, (Option<Instant>, V)>,
}

impl<K, V> Default for MemoryCache<K, V> {
    fn default() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }
}

impl<K, V> MemoryCache<K, V> {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn start_executor(cache: Arc<Mutex<Self>>, interval: Duration) -> JoinHandle<()>
    where
        K: Send + Sync + Clone + 'static + Hash + Eq + Debug,
        V: Send + Sync + Clone + 'static,
    {
        tokio::spawn(async move {
            let cache = Arc::clone(&cache);

            loop {
                let keys_to_delete = {
                    let cache = cache.lock().await;
                    let mut expired_keys = Vec::new();

                    for key in cache.keys().await {
                        if cache.is_expired(key).await.unwrap_or(false) {
                            expired_keys.push(key.clone());
                        }
                    }
                    expired_keys
                };

                for key in keys_to_delete {
                    cache.lock().await.delete(&key).await;
                }

                tokio::time::sleep(interval).await;
            }
        })
    }
}

#[async_trait]
impl<'a, K, V> Cache<'a, K, V> for MemoryCache<K, V>
where
    K: Send + Sync + Hash + Eq + Clone,
    V: Send + Sync,
{
    /// Get all keys in the cache
    async fn keys(&self) -> Vec<&K> {
        self.cache.keys().collect()
    }

    /// Create a value in the cache
    ///
    /// If the key already exists, the value is overwritten and the old value is returned.
    async fn create(&mut self, key: &K, value: V, duration: Option<Duration>) -> Option<V> {
        let expires = duration.map(|d| Self::duration_to_expires(d));

        self.cache
            .insert(key.to_owned(), (expires, value))
            .map(|(_, v)| v)
    }

    /// Get a value from the cache
    ///
    /// Returns `None` if the key does not exist.
    async fn get(&self, key: &K) -> Option<&V> {
        // ensure the entry is not expired
        if self.is_expired(key).await.unwrap_or(false) {
            return None;
        }

        self.cache.get(key).map(|(_, v)| v)
    }

    /// Get a mutable reference to a value in the cache
    ///
    /// Returns `None` if the key does not exist.
    async fn get_mut(&mut self, key: &K) -> Option<&mut V> {
        // ensure the entry is not expired
        if self.is_expired(key).await.unwrap_or(false) {
            return None;
        }

        self.cache.get_mut(key).map(|(_, v)| v)
    }

    /// Get a value from the cache or create it if it doesn't exist
    ///
    /// If the key already exists, the value is returned.
    /// If the key does not exist, the value is created and returned.
    async fn get_or_create(&mut self, key: &K, value: V, expires: Option<Duration>) -> Option<&V> {
        if !self.cache.contains_key(key) || self.is_expired(key).await.unwrap_or(false) {
            self.create(key, value, expires).await;
        }

        self.cache.get(key).map(|(_, v)| v)
    }

    /// Update a value in the cache
    ///
    /// If the key does not exist, the None is returned.
    async fn update(&mut self, key: &K, value: V) -> Option<&mut V> {
        self.get_mut(key).await.map(|v| {
            *v = value;
            v
        })
    }

    /// Delete a value from the cache
    ///
    /// Returns `None` if the key does not exist.
    async fn delete(&mut self, key: &K) -> Option<V> {
        self.cache.remove(key).map(|(_, v)| v)
    }

    /// Clear the cache
    async fn flush(&mut self) {
        self.cache.clear();
    }

    /// Check if a value is expired
    ///
    /// Returns `None` if the key does not exist or if expiration is not set.
    async fn is_expired(&self, key: &K) -> Option<bool> {
        self.cache
            .get(key)
            .and_then(|(expires, _)| expires.map(|e| e < Instant::now()))
    }

    /// Set the expiration time of a value
    ///
    /// If the key does not exist, none is returned.
    async fn set_expires(&mut self, key: &K, duration: Option<Duration>) {
        let expires = duration.map(|d| Self::duration_to_expires(d));

        if let Some((e, _)) = self.cache.get_mut(key) {
            *e = expires;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_memory_cache() {
        let mut cache = MemoryCache::<String, String>::new();
        let duration = Duration::from_secs(10);
        let key = "key".to_string();
        let value = "value".to_string();

        // create and get an entry
        cache.create(&key, value.clone(), Some(duration)).await;
        assert_eq!(cache.get(&key).await, Some(&value));

        // get an entry that doesn't exist
        assert_eq!(cache.get(&"key2".to_string()).await, None);

        // get_or_create an entry that exists
        assert_eq!(
            cache
                .get_or_create(&key, value.clone(), Some(duration))
                .await,
            Some(&value)
        );

        // get_or_create an entry that doesn't exist
        assert_eq!(
            cache
                .get_or_create(&"key2".to_string(), value.clone(), Some(duration))
                .await,
            Some(&value)
        );

        // update an entry
        let new_value = "new_value".to_string();
        cache.update(&key, new_value.clone()).await;
        assert_eq!(cache.get(&key).await, Some(&new_value));

        // expiration
        assert_eq!(cache.is_expired(&key).await, Some(false));
        cache.set_expires(&key, Some(Duration::from_secs(0))).await;
        assert_eq!(cache.is_expired(&key).await, Some(true));

        // delete an entry
        let key_to_delete = "key_to_delete".to_string();
        cache
            .create(&key_to_delete, value.clone(), Some(duration))
            .await;
        assert_eq!(cache.get(&key_to_delete).await, Some(&value));
        cache.delete(&key_to_delete).await;
        assert_eq!(cache.get(&key_to_delete).await, None);

        // flush the cache
        cache
            .create(&key_to_delete, value.clone(), Some(duration))
            .await;
        cache.flush().await;
        assert_eq!(cache.get(&key_to_delete).await, None);
    }
}
