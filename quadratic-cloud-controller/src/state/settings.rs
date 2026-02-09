use jsonwebtoken::{EncodingKey, jwk::JwkSet};
use quadratic_rust_shared::auth::jwt::{Claims, generate_jwt, get_kid_from_jwks, jwks_from_private_key_pem};
use quadratic_rust_shared::environment::Environment;
use quadratic_rust_shared::storage::StorageContainer;
use quadratic_rust_shared::storage::StorageType;
use quadratic_rust_shared::storage::file_system::{FileSystem, FileSystemConfig};
use quadratic_rust_shared::storage::s3::{S3, S3Config};
use tracing::info;
use url::Url;
use uuid::Uuid;

use crate::config::Config;
use crate::error::{ControllerError, Result};

/// Key ID for the cloud controller's signing key.
/// This is a constant since we derive the JWKS from the private key at startup.
const CONTROLLER_KEY_ID: &str = "quadratic_controller";

pub(crate) struct Settings {
    pub(crate) environment: Environment,
    pub(crate) public_host: String,
    pub(crate) public_port: String,
    pub(crate) worker_only_host: String,
    pub(crate) worker_only_port: String,
    pub(crate) worker_internal_host: String,
    pub(crate) multiplayer_host: String,
    pub(crate) multiplayer_port: String,
    pub(crate) files_host: String,
    pub(crate) files_port: String,
    pub(crate) connection_host: String,
    pub(crate) connection_port: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) quadratic_jwt_encoding_key: EncodingKey,
    pub(crate) quadratic_jwt_expiration_seconds: u64,
    pub(crate) quadratic_jwks: JwkSet,
    pub(crate) _worker_jwt_email: String,
    pub(crate) _namespace: String,
    pub(crate) version: String,
    pub(crate) storage: StorageContainer,
}

/// Gets the version of the crate (which should be in sync with the client version)
pub(crate) fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

impl Settings {
    pub(crate) async fn new(config: &Config) -> Result<Self> {
        let private_key_pem = config.quadratic_jwt_encoding_key.replace(r"\n", "\n");

        let quadratic_jwt_encoding_key = EncodingKey::from_rsa_pem(private_key_pem.as_bytes())
            .map_err(|e| ControllerError::Settings(e.to_string()))?;

        // Derive the JWKS from the private key to ensure they always match.
        // This eliminates configuration mismatches between the signing key and validation JWKS.
        let quadratic_jwks = jwks_from_private_key_pem(&private_key_pem, CONTROLLER_KEY_ID)?;

        info!(
            "Derived JWKS from private key with kid: {}",
            CONTROLLER_KEY_ID
        );

        let storage = Self::new_storage(config)
            .await
            .map_err(|e| ControllerError::Settings(e.to_string()))?;

        let settings = Settings {
            environment: config.environment,
            public_host: config.public_host.to_owned(),
            public_port: config.public_port.to_owned(),
            worker_internal_host: config.worker_internal_host.to_owned(),
            worker_only_host: config.worker_only_host.to_owned(),
            worker_only_port: config.worker_only_port.to_owned(),
            multiplayer_host: config.multiplayer_host.to_owned(),
            multiplayer_port: config.multiplayer_port.to_owned(),
            connection_host: config.connection_host.to_owned(),
            connection_port: config.connection_port.to_owned(),
            files_host: config.files_host.to_owned(),
            files_port: config.files_port.to_owned(),
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            quadratic_jwt_encoding_key,
            quadratic_jwt_expiration_seconds: config.quadratic_jwt_expiration_seconds,
            quadratic_jwks,
            _worker_jwt_email: config.worker_jwt_email.to_owned(),
            _namespace: config.namespace.to_owned(),
            version: version(),
            storage,
        };

        Ok(settings)
    }

    async fn new_storage(config: &Config) -> std::result::Result<StorageContainer, String> {
        let is_local = config.environment.is_local_or_docker();

        match config.storage_type {
            StorageType::S3 => {
                let bucket_name = config
                    .aws_s3_bucket_name
                    .as_ref()
                    .ok_or("Expected AWS_S3_BUCKET_NAME to have a value")?
                    .to_owned();
                let region = config
                    .aws_s3_region
                    .as_ref()
                    .ok_or("Expected AWS_S3_REGION to have a value")?
                    .to_owned();
                let access_key_id = config
                    .aws_s3_access_key_id
                    .as_ref()
                    .ok_or("Expected AWS_S3_ACCESS_KEY_ID to have a value")?
                    .to_owned();
                let secret_access_key = config
                    .aws_s3_secret_access_key
                    .as_ref()
                    .ok_or("Expected AWS_S3_SECRET_ACCESS_KEY to have a value")?
                    .to_owned();

                Ok(StorageContainer::S3(S3::new(
                    S3Config::new(
                        bucket_name,
                        region,
                        access_key_id,
                        secret_access_key,
                        "Quadratic Cloud Controller",
                        is_local,
                    )
                    .await,
                )))
            }
            StorageType::FileSystem => {
                let storage_dir = config
                    .storage_dir
                    .as_ref()
                    .ok_or("Expected STORAGE_DIR to have a value")?
                    .to_owned();
                let encryption_keys = config
                    .storage_encryption_keys
                    .as_ref()
                    .ok_or("Expected STORAGE_ENCRYPTION_KEYS to have a value")?
                    .to_owned();

                Ok(StorageContainer::FileSystem(FileSystem::new(
                    FileSystemConfig {
                        path: storage_dir,
                        encryption_keys,
                        presigned_url_base: format!(
                            "http://{}:{}/storage/presigned",
                            config.files_host, config.files_port
                        ),
                    },
                )))
            }
        }
    }

    /// Generate a JWT token for a worker with a specific JTI for one-time use
    pub(crate) fn generate_worker_jwt_with_jti(
        &self,
        email: &str,
        file_id: Uuid,
        team_id: Uuid,
        jti: &str,
    ) -> Result<String> {
        let kid = get_kid_from_jwks(&self.quadratic_jwks)?;
        let mut claims = Claims::new(
            email.into(),
            self.quadratic_jwt_expiration_seconds as usize,
            Some(file_id),
            Some(team_id),
        );
        claims.jti = Some(jti.to_string());
        let jwt = generate_jwt(claims, &kid, &self.quadratic_jwt_encoding_key)?;

        Ok(jwt)
    }

    // Get the scheme for the files service
    pub(crate) fn files_scheme(&self) -> String {
        if self.environment == Environment::Development
            || self.environment == Environment::Production
        {
            "https".into()
        } else {
            "http".into()
        }
    }

    // Replace the host, port, and scheme for a presigned url
    pub(crate) fn files_presigned_url(&self, url: &str) -> Result<Url> {
        let error =
            |message: &str| ControllerError::WorkerPresignedUrl(format!("{message}: {url:?}"));
        let mut url = Url::parse(url).map_err(|e| error(&e.to_string()))?;

        // if this is an S3 presigned url (contains AWS signature parameters), just return the url
        if url.query_pairs().any(|(key, _)| key == "X-Amz-Signature") {
            return Ok(url);
        }

        // replace the scheme
        let scheme = self.files_scheme();
        url.set_scheme(&scheme)
            .map_err(|_e| error("Error setting scheme"))?;

        // replace the host
        let files_host = self.files_host.to_string();
        url.set_host(Some(&files_host))
            .map_err(|e| error(&e.to_string()))?;

        // replace the port
        let files_port = self
            .files_port
            .parse::<u16>()
            .map_err(|e| error(&e.to_string()))?;
        url.set_port(Some(files_port))
            .map_err(|_e| error("Error setting port"))?;

        Ok(url)
    }

    // Get the URL for the controller
    pub(crate) fn controller_url(&self) -> String {
        let controller_port = self.worker_only_port.to_string();
        let controller_host = self.worker_internal_host.to_string();

        format!("http://{controller_host}:{controller_port}")
    }

    pub(crate) fn multiplayer_url(&self) -> String {
        let multiplayer_port = self.multiplayer_port.to_string();
        let multiplayer_host = self.multiplayer_host.to_string();
        let is_dev_or_prod = self.environment == Environment::Development
            || self.environment == Environment::Production;

        if is_dev_or_prod {
            format!("wss://{multiplayer_host}/ws")
        } else {
            format!("ws://{multiplayer_host}:{multiplayer_port}/ws")
        }
    }

    // Get the URL for the connection
    pub(crate) fn connection_url(&self) -> String {
        let connection_port = self.connection_port.to_string();
        let connection_host = self.connection_host.to_string();

        let scheme = if self.environment == Environment::Development
            || self.environment == Environment::Production
        {
            "https"
        } else {
            "http"
        };

        format!("{scheme}://{connection_host}:{connection_port}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gets_version() {
        let version = version();
        assert!(!version.is_empty());
    }

    #[tokio::test]
    async fn test_settings() {
        let config = Config::new().unwrap();
        let settings = Settings::new(&config).await.unwrap();
        assert_eq!(settings.version, version());
    }
}
