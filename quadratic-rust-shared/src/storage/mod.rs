use async_trait::async_trait;
use bytes::Bytes;
use file_system::FileSystemConfig;
use s3::S3Config;

use crate::{error::Result, SharedError, Storage as StorageError};

pub mod file_system;
pub mod s3;

#[derive(Debug)]
pub enum Config {
    S3(S3Config),
    FileSystem(FileSystemConfig),
}

#[derive(Debug)]
pub enum StorageContainer {
    S3(s3::S3),
    FileSystem(file_system::FileSystem),
}

// TODO(ddimaria): this is a temp hack to get around some trait issues, do something better
#[async_trait]
impl Storage for StorageContainer {
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

    fn path(&self) -> &str {
        match self {
            Self::S3(s3) => s3.path(),
            Self::FileSystem(fs) => fs.path(),
        }
    }
}

#[async_trait]
pub trait Storage {
    async fn read(&self, key: &str) -> Result<Bytes>;
    async fn write<'a>(&self, key: &'a str, data: &'a Bytes) -> Result<()>;
    fn path(&self) -> &str;

    fn read_error(key: &str, e: impl ToString) -> SharedError {
        SharedError::Storage(StorageError::Read(key.into(), e.to_string()))
    }

    fn write_error(key: &str, e: impl ToString) -> SharedError {
        SharedError::Storage(StorageError::Write(key.into(), e.to_string()))
    }
}
