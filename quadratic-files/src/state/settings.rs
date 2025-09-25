use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::aws::client;
use quadratic_rust_shared::environment::Environment;
use quadratic_rust_shared::storage::file_system::{FileSystem, FileSystemConfig};
use quadratic_rust_shared::storage::s3::{S3, S3Config};
use quadratic_rust_shared::storage::{StorageContainer, StorageType};

use crate::config::Config;

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) storage: StorageContainer,
    pub(crate) pubsub_processed_transactions_channel: String,
}

impl Settings {
    // Create a new Settings struct from the provided Config.
    // Panics are OK here since this is set at startup and we want to fail fast.
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        let is_local = config.environment.is_local_or_docker();
        let expected = |val: &Option<String>, var: &str| {
            val.to_owned()
                .unwrap_or_else(|| panic!("Expected {var} to have a value"))
        };

        let storage = match config.storage_type {
            StorageType::S3 => StorageContainer::S3(S3::new(S3Config {
                client: client(
                    &expected(&config.aws_s3_access_key_id, "AWS_S3_ACCESS_KEY_ID"),
                    &expected(&config.aws_s3_secret_access_key, "AWS_S3_SECRET_ACCESS_KEY"),
                    &expected(&config.aws_s3_region, "AWS_S3_REGION"),
                    "Quadratic File Service",
                    is_local,
                )
                .await,
                bucket: expected(&config.aws_s3_bucket_name, "AWS_S3_BUCKET_NAME"),
            })),
            StorageType::FileSystem => {
                StorageContainer::FileSystem(FileSystem::new(FileSystemConfig {
                    path: expected(&config.storage_dir, "STORAGE_DIR"),
                    encryption_keys: config
                        .storage_encryption_keys
                        .to_owned()
                        .expect("Expected STORAGE_ENCRYPTION_KEYS to have a value"),
                }))
            }
        };

        Settings {
            jwks,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            storage,
            pubsub_processed_transactions_channel: config
                .pubsub_processed_transactions_channel
                .to_owned(),
        }
    }
}
