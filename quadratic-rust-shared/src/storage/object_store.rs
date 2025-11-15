use crate::SharedError;
use crate::arrow::object_store::ObjectStore;
use crate::arrow::object_store::new_filesystem_object_store;
use crate::arrow::object_store::new_s3_object_store;
use crate::error::Result;
use crate::storage::StorageConfig;
use crate::storage::error::Storage as StorageError;
use crate::storage::file_system::FileSystemConfig;
use crate::storage::s3::S3Config;
use std::path::PathBuf;
use std::sync::Arc;
use url::Url;

impl TryFrom<StorageConfig> for Arc<dyn ObjectStore> {
    type Error = SharedError;

    fn try_from(storage_config: StorageConfig) -> Result<Self> {
        match storage_config {
            StorageConfig::S3(s3_config) => {
                s3_object_store(&s3_config).map(|(object_store, _)| object_store)
            }
            StorageConfig::FileSystem(filesystem_config) => {
                filesystem_object_store(&filesystem_config).map(|(object_store, _)| object_store)
            }
        }
    }
}

/// Create a new filesystem object store.
fn filesystem_object_store(
    filesystem_config: &FileSystemConfig,
) -> Result<(Arc<dyn ObjectStore>, PathBuf)> {
    new_filesystem_object_store(&filesystem_config.path)
        .map_err(|e| SharedError::Storage(StorageError::CreateObjectStore(e.to_string())))
}

/// Create a new S3 object store.
fn s3_object_store(s3_config: &S3Config) -> Result<(Arc<dyn ObjectStore>, Url)> {
    new_s3_object_store(
        &s3_config.bucket,
        &s3_config.region,
        &s3_config.access_key_id,
        &s3_config.secret_access_key,
        s3_config.is_local,
    )
    .map_err(|e| SharedError::Storage(StorageError::CreateObjectStore(e.to_string())))
}
