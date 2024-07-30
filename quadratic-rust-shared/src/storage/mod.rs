use async_trait::async_trait;
use bytes::Bytes;
use file_system::FileSystemConfig;
use s3::S3Config;

use crate::{error::Result, SharedError, Storage as StorageError};

pub mod file_system;
pub mod s3;

#[derive(Debug)]
pub enum Config<'a> {
    S3(S3Config<'a>),
    FileSystem(FileSystemConfig),
}

#[async_trait]
pub trait Storage<'a> {
    type Config;

    async fn read(&self, key: &str) -> Result<Bytes>;
    async fn write(&self, key: &'a str, data: &'a Bytes) -> Result<()>;

    fn read_error(key: &str, e: impl ToString) -> SharedError {
        SharedError::Storage(StorageError::Read(key.into(), e.to_string()))
    }

    fn write_error(key: &str, e: impl ToString) -> SharedError {
        SharedError::Storage(StorageError::Write(key.into(), e.to_string()))
    }
}
