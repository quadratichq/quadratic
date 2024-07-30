use async_trait::async_trait;
use aws_sdk_s3::Client;
use bytes::Bytes;

use super::Storage;
use crate::{
    aws::s3::{download_object, upload_object},
    error::Result,
};

#[derive(Debug)]
pub struct S3Config<'a> {
    pub client: Client,
    pub bucket: &'a str,
}

pub struct S3<'a> {
    pub config: S3Config<'a>,
}

#[async_trait]
impl<'a> Storage<'a> for S3<'a> {
    type Config = S3Config<'a>;

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

    async fn write(&self, key: &'a str, data: &'a Bytes) -> Result<()> {
        let S3Config { client, bucket } = &self.config;

        upload_object(client, bucket, key, data)
            .await
            .map_err(|e| Self::write_error(key, &e))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {}
