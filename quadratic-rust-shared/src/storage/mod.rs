//! Storage code that implements the Storage trait

use async_trait::async_trait;
use bytes::Bytes;
use file_system::FileSystemConfig;
use s3::S3Config;
use serde::Deserialize;
use strum_macros::Display;

use crate::{SharedError, error::Result, storage::error::Storage as StorageError};

pub mod error;
pub mod file_system;
#[cfg(feature = "arrow")]
pub mod object_store;
pub mod s3;

#[derive(Debug, Clone)]
pub enum StorageConfig {
    S3(S3Config),
    FileSystem(FileSystemConfig),
}

#[derive(Debug)]
pub enum StorageContainer {
    S3(s3::S3),
    FileSystem(file_system::FileSystem),
}

impl From<&StorageContainer> for StorageConfig {
    fn from(container: &StorageContainer) -> Self {
        match container {
            StorageContainer::S3(s3) => StorageConfig::S3(s3.config()),
            StorageContainer::FileSystem(fs) => StorageConfig::FileSystem(fs.config()),
        }
    }
}

#[derive(Deserialize, Debug, Display)]
#[serde(rename_all = "kebab-case")]
pub enum StorageType {
    S3,
    FileSystem,
}

#[async_trait]
pub trait Storage {
    type Config;

    async fn read(&self, key: &str) -> Result<Bytes>;
    async fn write<'a>(&self, key: &'a str, data: &'a Bytes) -> Result<()>;
    async fn presigned_url(&self, key: &str) -> Result<String>;
    fn path(&self) -> &str;
    fn config(&self) -> Self::Config;

    fn read_error(key: &str, e: impl ToString) -> SharedError {
        StorageError::Read(key.into(), e.to_string()).into()
    }

    fn write_error(key: &str, e: impl ToString) -> SharedError {
        StorageError::Write(key.into(), e.to_string()).into()
    }

    fn presigned_url_error(key: &str, e: impl ToString) -> SharedError {
        StorageError::GeneratePresignedUrl(key.into(), e.to_string()).into()
    }
}

// TODO(ddimaria): this is a temp hack to get around some trait issues, do something better
#[async_trait]
impl Storage for StorageContainer {
    type Config = StorageConfig;

    async fn read(&self, key: &str) -> Result<Bytes> {
        match self {
            Self::S3(s3) => s3.read(key).await,
            Self::FileSystem(fs) => fs.read(key).await,
        }
    }

    async fn write<'a>(&self, key: &'a str, data: &'a Bytes) -> Result<()> {
        match self {
            Self::S3(s3) => s3.write(key, data).await,
            Self::FileSystem(fs) => fs.write(key, data).await,
        }
    }

    async fn presigned_url(&self, data: &str) -> Result<String> {
        match self {
            Self::S3(s3) => s3.presigned_url(data).await,
            Self::FileSystem(fs) => fs.presigned_url(data).await,
        }
    }

    fn path(&self) -> &str {
        match self {
            Self::S3(s3) => s3.path(),
            Self::FileSystem(fs) => fs.path(),
        }
    }

    fn config(&self) -> StorageConfig {
        match self {
            Self::S3(s3) => StorageConfig::S3(s3.config()),
            Self::FileSystem(fs) => StorageConfig::FileSystem(fs.config()),
        }
    }
}
