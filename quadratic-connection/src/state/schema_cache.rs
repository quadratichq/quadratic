//! Schema Cache
//!
//! Cache schema requests for performance.

use quadratic_rust_shared::cache::{Cache as CacheTrait, memory::MemoryCache};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::server::SCHEMA_CACHE_DURATION_S;
use crate::sql::Schema;

#[derive(Debug, Clone)]
pub(crate) struct SchemaCache {
    pub(crate) schema: Arc<Mutex<MemoryCache<Uuid, Schema>>>,
}

impl SchemaCache {
    /// Create a new cache
    pub(crate) fn new() -> Self {
        Self {
            schema: Arc::new(Mutex::new(MemoryCache::new())),
        }
    }

    /// Get a schema from the cache.
    /// If the schema is not found or expired, None is returned.
    pub(crate) async fn get(&self, uuid: Uuid) -> Option<Schema> {
        (*self.schema.lock().await).get(&uuid).await.cloned()
    }

    /// Add a schema to the cache
    pub(crate) async fn add(&self, uuid: Uuid, schema: Schema) {
        (*self.schema.lock().await)
            .create(&uuid, schema, Some(SCHEMA_CACHE_DURATION_S))
            .await;
    }

    /// Remove a schema from the cache
    pub(crate) async fn delete(&self, uuid: Uuid) -> Option<Schema> {
        (*self.schema.lock().await).delete(&uuid).await
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use quadratic_rust_shared::sql::{
        bigquery_connection::tests::expected_bigquery_schema, schema::SchemaTable,
    };

    #[tokio::test]
    async fn test_schema_cache() {
        let schema = Schema {
            id: Uuid::new_v4(),
            name: "test".into(),
            r#type: "test".into(),
            database: "test".into(),
            tables: vec![SchemaTable {
                name: "test".into(),
                schema: "test".into(),
                columns: expected_bigquery_schema(),
            }],
        };
        let cache = SchemaCache::new();
        let id = Uuid::new_v4();
        let non_existent_id = Uuid::new_v4();

        let result = cache.get(id).await;
        assert!(result.is_none());

        cache.add(id, schema.clone()).await;
        let result = cache.get(id).await;
        assert_eq!(result, Some(schema.clone()));

        let result = cache.get(non_existent_id).await;
        assert!(result.is_none());

        let result = cache.delete(id).await;
        assert_eq!(result, Some(schema));

        let result = cache.get(id).await;
        assert!(result.is_none());

        let result = cache.delete(non_existent_id).await;
        assert!(result.is_none());
    }
}
