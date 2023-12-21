pub mod s3;

pub use aws_config::{retry::RetryConfig, BehaviorVersion, Region};
pub use aws_sdk_s3::{
    config::{Credentials, SharedCredentialsProvider},
    Client,
};

pub async fn client(
    access_key_id: &str,
    secret_access_key: &str,
    region: &str,
    provider_name: &'static str,
) -> Client {
    let creds = Credentials::new(access_key_id, secret_access_key, None, None, provider_name);
    let conf = aws_config::SdkConfig::builder()
        .region(Region::new(region.to_owned()))
        .credentials_provider(SharedCredentialsProvider::new(creds))
        .retry_config(RetryConfig::standard().with_max_attempts(5))
        .behavior_version(BehaviorVersion::latest())
        .build();

    Client::new(&conf)
}

#[cfg(test)]
mod tests {

    use super::*;
}
