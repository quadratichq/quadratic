//! File System
//!
//! Functions to interact with the file system

use async_trait::async_trait;
use bytes::Bytes;
use std::path::{Path, PathBuf};
use tokio::fs::{File, create_dir_all};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use super::Storage;
use crate::SharedError;
use crate::error::Result;
use crate::storage::error::Storage as StorageError;

/// File System configuration
#[derive(Debug, Clone)]
pub struct FileSystemConfig {
    pub path: String,
    pub encryption_keys: Vec<String>,
}

/// File System
#[derive(Debug, Clone)]
pub struct FileSystem {
    pub config: FileSystemConfig,
}

#[async_trait]
impl Storage for FileSystem {
    type Config = FileSystemConfig;

    /// Read the file from the file system and return the bytes.
    async fn read(&self, key: &str) -> Result<Bytes> {
        let file_path = self.full_path(key, false).await?.0;
        let mut bytes = vec![];
        let mut file = File::open(file_path)
            .await
            .map_err(|e| Self::read_error(key, &e))?;

        file.read_to_end(&mut bytes)
            .await
            .map_err(|e| Self::read_error(key, &e))?;

        Ok(bytes.into())
    }

    /// Write the bytes to the file system.
    async fn write<'a>(&self, key: &'a str, data: &'a Bytes) -> Result<()> {
        let file_path = self.full_path(key, true).await?.0;
        let mut file = File::create(file_path)
            .await
            .map_err(|e| Self::write_error(key, &e))?;
        file.write_all(data)
            .await
            .map_err(|e| Self::write_error(key, &e))?;

        Ok(())
    }

    /// Return the path to the file system.
    fn path(&self) -> &str {
        &self.config.path
    }

    /// Return the configuration
    fn config(&self) -> Self::Config {
        self.config.clone()
    }
}

impl FileSystem {
    /// Create a new File System
    pub fn new(config: FileSystemConfig) -> Self {
        Self { config }
    }

    /// Return the full path to the file and the directory.
    pub async fn full_path(&self, key: &str, create_dir: bool) -> Result<(PathBuf, PathBuf)> {
        let FileSystemConfig { path, .. } = &self.config;
        let parts = key.split('-').collect::<Vec<&str>>();
        let invalid_key = || SharedError::Storage(StorageError::InvalidKey(key.to_owned()));

        // expecting uuid-sequence_number.grid
        // e.g. aad29798-0bf9-4b25-ab45-e22efd37d446-0.grid
        if parts.len() < 5 {
            return Err(invalid_key());
        }

        let uuid = &parts[0..parts.len() - 1].join("-");
        let file_name = parts.last().ok_or_else(invalid_key)?;
        let dir = Path::new(path).join(uuid);
        let full_path = dir.join(file_name);

        if create_dir {
            create_dir_all(dir.to_owned()).await.map_err(|e| {
                SharedError::Storage(StorageError::CreateDirectory(
                    dir.to_string_lossy().into_owned(),
                    e.to_string(),
                ))
            })?;
        }

        Ok((full_path, dir))
    }
}

#[cfg(test)]
mod tests {
    use tokio::fs::{remove_dir, remove_file};
    use uuid::Uuid;

    use super::*;
    use std::env;

    fn config() -> FileSystemConfig {
        FileSystemConfig {
            path: env::temp_dir().to_str().unwrap().to_string(),
            encryption_keys: vec![],
        }
    }

    #[tokio::test]
    async fn file_system_write_and_read() {
        let config = config();
        let storage = FileSystem { config };
        let file_name = Uuid::new_v4().to_string();
        let seqence_number = 0;
        let key = &format!("{file_name}-{seqence_number}.grid");
        let data = &Bytes::from("Hello, world!");

        storage.write(key, data).await.unwrap();
        let read_data = storage.read(key).await.unwrap();

        // cleanup
        let (full_path, dir) = storage.full_path(key, false).await.unwrap();
        remove_file(full_path).await.unwrap();
        remove_dir(dir).await.unwrap();

        assert_eq!(data, &read_data);
    }
}
