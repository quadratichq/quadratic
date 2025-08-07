//! AWS S3
//!
//! Functions to interact with AWS S3

use aws_sdk_s3::{
    Client,
    operation::{get_object::GetObjectOutput, put_object::PutObjectOutput},
    primitives::{ByteStream, SdkBody},
};

use crate::aws::error::Aws as AwsError;
use crate::error::{Result, SharedError};

/// Download an object from S3
pub async fn download_object(client: &Client, bucket: &str, key: &str) -> Result<GetObjectOutput> {
    client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|error| {
            SharedError::Aws(AwsError::S3(format!(
                "Error retrieving file {key} from bucket {bucket}: {error:?}."
            )))
        })
}

/// Upload an object to S3
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
            SharedError::Aws(AwsError::S3(format!(
                "Error uploading file {key} to bucket {bucket}: {error:?}."
            )))
        })
}

#[cfg(test)]
pub mod tests {
    // use aws_config::{imds::Client as ImdsClient, provider_config::ProviderConfig};
    // use aws_sdk_s3::primitives::SdkBody;
    // use aws_smithy_async::test_util::InstantSleep;
    // use aws_smithy_runtime::client::http::test_util::{ReplayEvent, StaticReplayClient};
    // use aws_smithy_runtime_api::client::orchestrator::{HttpRequest, HttpResponse};
    // use http::Uri;

    // pub fn imds_request(path: &'static str, token: &str) -> HttpRequest {
    //     http::Request::builder()
    //         .uri(Uri::from_static(path))
    //         .method("GET")
    //         .header("x-aws-ec2-metadata-token", token)
    //         .body(SdkBody::empty())
    //         .unwrap()
    //         .try_into()
    //         .unwrap()
    // }

    // pub fn imds_response(body: &'static str) -> HttpResponse {
    //     HttpResponse::try_from(
    //         http::Response::builder()
    //             .status(200)
    //             .body(SdkBody::from(body))
    //             .unwrap(),
    //     )
    //     .unwrap()
    // }

    // pub fn make_imds_client(http_client: &StaticReplayClient) -> ImdsClient {
    //     tokio::time::pause();
    //     ImdsClient::builder()
    //         .configure(
    //             &ProviderConfig::empty()
    //                 .with_sleep_impl(InstantSleep::unlogged())
    //                 .with_http_client(http_client.clone()),
    //         )
    //         .build()
    // }

    // pub fn mock_imds_client(events: Vec<ReplayEvent>) -> (ImdsClient, StaticReplayClient) {
    //     let http_client = StaticReplayClient::new(events);
    //     let client = make_imds_client(&http_client);
    //     (client, http_client)
    // }
}
