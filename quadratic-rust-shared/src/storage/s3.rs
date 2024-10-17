use async_trait::async_trait;
use aws_sdk_s3::Client;
use bytes::Bytes;

use super::Storage;
use crate::{
    aws::s3::{download_object, upload_object},
    error::Result,
};

#[derive(Debug, Clone)]
pub struct S3Config {
    pub client: Client,
    pub bucket: String,
}

#[derive(Debug, Clone)]
pub struct S3 {
    pub config: S3Config,
}

#[async_trait]
impl Storage for S3 {
    type Config = S3Config;

    /// Read the file from the S3 bucket and return the bytes.
    async fn read(&self, key: &str) -> Result<Bytes> {
        let S3Config { client, bucket } = &self.config;

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
        let S3Config { client, bucket } = &self.config;

        upload_object(client, bucket, key, data)
            .await
            .map_err(|e| Self::write_error(key, &e))?;

        Ok(())
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
    pub fn new(config: S3Config) -> Self {
        Self { config }
    }
}

#[cfg(test)]
mod tests {
    // TODO(ddimaria): add tests once we have S3 mocks in place
}
