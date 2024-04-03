use aws_sdk_s3::{
    operation::{get_object::GetObjectOutput, put_object::PutObjectOutput},
    primitives::{ByteStream, SdkBody},
    Client,
};

use crate::error::{Aws, Result, SharedError};

pub async fn download_object(client: &Client, bucket: &str, key: &str) -> Result<GetObjectOutput> {
    client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|error| {
            SharedError::Aws(Aws::S3(format!(
                "Error retrieving file {} from bucket {}: {:?}.",
                key, bucket, error
            )))
        })
}

pub async fn upload_object(
    client: &Client,
    bucket: &str,
    key: &str,
    body: &[u8],
) -> Result<PutObjectOutput> {
    let body = ByteStream::from(SdkBody::from(body));

    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body)
        .send()
        .await
        .map_err(|error| {
            SharedError::Aws(Aws::S3(format!(
                "Error uploading file {key} to bucket {bucket}: {:?}.",
                error
            )))
        })
}

#[cfg(test)]
mod tests {}
