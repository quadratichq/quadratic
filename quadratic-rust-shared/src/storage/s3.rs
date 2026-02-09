//! S3
//!
//! Functions to interact with S3

use async_trait::async_trait;
use aws_sdk_s3::Client;
use aws_sdk_s3::presigning::PresigningConfig;
use bytes::Bytes;
use std::time::Duration;

use super::Storage;
use crate::{
    aws::{
        client,
        s3::{download_object, upload_object},
    },
    error::Result,
    storage::error::Storage as StorageError,
};

/// S3 configuration
#[derive(Debug, Clone)]
pub struct S3Config {
    pub client: Client,
    pub bucket: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub is_local: bool,
}

impl S3Config {
    pub async fn new(
        bucket: String,
        region: String,
        access_key_id: String,
        secret_access_key: String,
        provider_name: &'static str,
        is_local: bool,
    ) -> Self {
        let client = client(
            &access_key_id,
            &secret_access_key,
            &region,
            provider_name,
            is_local,
        )
        .await;

        Self {
            client,
            bucket,
            region,
            access_key_id,
            secret_access_key,
            is_local,
        }
    }
}

/// S3
#[derive(Debug, Clone)]
pub struct S3 {
    pub config: S3Config,
}

#[async_trait]
impl Storage for S3 {
    type Config = S3Config;

    /// Read the file from the S3 bucket and return the bytes.
    async fn read(&self, key: &str) -> Result<Bytes> {
        let S3Config { client, bucket, .. } = &self.config;

        let file = download_object(client, bucket, key)
            .await
            .map_err(|e| Self::read_error(key, &e))?;

        let bytes = file
            .body
            .collect()
            .await
            .map_err(|e| Self::read_error(key, &e))?
            .into_bytes();

        Ok(bytes)
    }

    /// Write the bytes to the S3 bucket.
    async fn write<'a>(&self, key: &'a str, data: &'a Bytes) -> Result<()> {
        let S3Config { client, bucket, .. } = &self.config;

        upload_object(client, bucket, key, data)
            .await
            .map_err(|e| Self::write_error(key, &e))?;

        Ok(())
    }

    /// Generate a presigned GET URL (for downloads)
    async fn presigned_url(&self, data: &str) -> Result<String> {
        let S3Config { client, bucket, .. } = &self.config;
        let presigning_config = PresigningConfig::builder()
            .expires_in(Duration::from_secs(60 * 5)) // Valid for 5 minutes
            .build()
            .map_err(|e| StorageError::GeneratePresignedUrl(data.to_string(), e.to_string()))?;

        let presigned_request = client
            .get_object()
            .bucket(bucket)
            .key(data)
            .presigned(presigning_config)
            .await
            .map_err(|e| StorageError::GeneratePresignedUrl(data.to_string(), e.to_string()))?;

        Ok(presigned_request.uri().to_string())
    }

    /// Generate a presigned PUT URL (for uploads)
    async fn presigned_upload_url(&self, key: &str, content_type: &str) -> Result<String> {
        let S3Config { client, bucket, .. } = &self.config;
        let presigning_config = PresigningConfig::builder()
            .expires_in(Duration::from_secs(60 * 60)) // Valid for 1 hour
            .build()
            .map_err(|e| StorageError::GeneratePresignedUrl(key.to_string(), e.to_string()))?;

        let presigned_request = client
            .put_object()
            .bucket(bucket)
            .key(key)
            .content_type(content_type)
            .presigned(presigning_config)
            .await
            .map_err(|e| StorageError::GeneratePresignedUrl(key.to_string(), e.to_string()))?;

        Ok(presigned_request.uri().to_string())
    }

    /// Return the S3 bucket.
    fn path(&self) -> &str {
        &self.config.bucket
    }

    /// Return the configuration
    fn config(&self) -> Self::Config {
        self.config.clone()
    }
}

impl S3 {
    /// Create a new S3
    pub fn new(config: S3Config) -> Self {
        Self { config }
    }
}

#[cfg(test)]
mod tests {
    // TODO(ddimaria): add tests once we have S3 mocks in place
}
