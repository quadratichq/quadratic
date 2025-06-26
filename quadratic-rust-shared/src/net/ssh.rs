//! SSH
//!
//! SSH client implementation

use std::borrow::Cow;
use std::sync::Arc;
use std::time::Duration;

use russh::client::{Config, Handle, Handler};
use russh::keys::{PrivateKeyWithHashAlg, decode_secret_key, load_openssh_certificate, ssh_key};
use russh::{ChannelMsg, Disconnect, Preferred};
use tokio::io::AsyncWriteExt;
use tokio::net::ToSocketAddrs;

use crate::SharedError;
use crate::error::Result;
use crate::net::error::Net;

/// SSH config
#[derive(Debug, Clone)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: String,
    pub private_key_password: Option<String>,
    pub openssh_certificate: Option<String>,
}

impl SshConfig {
    /// Create a new SSH config
    pub fn new(
        host: String,
        port: u16,
        username: String,
        password: Option<String>,
        private_key: String,
        private_key_password: Option<String>,
    ) -> Self {
        Self {
            host,
            port,
            username,
            password,
            private_key,
            private_key_password,
            openssh_certificate: None,
        }
    }

    /// Connect to the SSH server
    pub async fn connect(self) -> Result<Session> {
        Session::connect(
            self.private_key,
            self.private_key_password,
            self.username,
            self.password,
            self.openssh_certificate,
            (self.host, self.port),
        )
        .await
    }
}

/// SSH client
pub struct Client;

// Ovverides the default handler for the SSH client, useful for debugging
impl Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // println!("check_server_key");
        Ok(true)
    }

    async fn openssh_ext_host_keys_announced(
        &mut self,
        _keys: Vec<ssh_key::PublicKey>,
        _session: &mut russh::client::Session,
    ) -> Result<(), Self::Error> {
        // println!("openssh_ext_host_keys_announced");
        Ok(())
    }
}

/// SSH session
///
/// A Session is a handle used to send messages to a client outside of
/// the request/response cycle.
pub struct Session {
    pub session: Handle<Client>,
}

impl Session {
    /// Configure the session with sensible defaults
    fn config() -> Config {
        Config {
            inactivity_timeout: Some(Duration::from_secs(5)),
            preferred: Preferred {
                kex: Cow::Owned(vec![
                    russh::kex::CURVE25519_PRE_RFC_8731,
                    russh::kex::EXTENSION_SUPPORT_AS_CLIENT,
                ]),
                ..Default::default()
            },
            ..<_>::default()
        }
    }

    /// Connect to the session
    async fn connect<A: ToSocketAddrs>(
        key: String,
        key_password: Option<String>,
        user: String,
        _password: Option<String>,
        openssh_cert_plain: Option<String>,
        addrs: A,
    ) -> Result<Self> {
        let key_pair = decode_secret_key(&key, key_password.as_deref()).map_err(Self::error)?;

        // load ssh certificate
        let mut openssh_cert = None;
        if let Some(openssh_cert_plain) = openssh_cert_plain {
            openssh_cert = Some(load_openssh_certificate(openssh_cert_plain).map_err(Self::error)?);
        }

        let config = Arc::new(Self::config());

        // connect to the session
        let mut session = russh::client::connect(config, addrs, Client)
            .await
            .map_err(Self::error)?;

        // use publickey authentication
        match openssh_cert {
            // use publickey+cert authentication
            Some(cert) => {
                let auth_res = session
                    .authenticate_openssh_cert(user, Arc::new(key_pair), cert)
                    .await
                    .map_err(Self::error)?;

                if !auth_res.success() {
                    return Err(Self::error("Authentication (with publickey+cert) failed"));
                }
            }
            // use publickey authentication
            None => {
                let auth_res = session
                    .authenticate_publickey(
                        user,
                        PrivateKeyWithHashAlg::new(
                            Arc::new(key_pair),
                            session
                                .best_supported_rsa_hash()
                                .await
                                .map_err(Self::error)?
                                .flatten(),
                        ),
                    )
                    .await
                    .map_err(Self::error)?;

                if !auth_res.success() {
                    return Err(Self::error("Authentication (with publickey) failed"));
                }
            }
        }

        Ok(Self { session })
    }

    /// Call a command on the session
    /// Used for debugging
    pub async fn call(&mut self, command: &str) -> Result<u32> {
        let mut channel = self
            .session
            .channel_open_session()
            .await
            .map_err(Self::error)?;
        channel.exec(true, command).await.map_err(Self::error)?;

        let mut code = None;
        let mut stdout = tokio::io::stdout();

        loop {
            // There's an event available on the session channel
            let Some(msg) = channel.wait().await else {
                break;
            };
            match msg {
                // Write data to the terminal
                ChannelMsg::Data { ref data } => {
                    stdout.write_all(data).await.map_err(Self::error)?;
                    stdout.flush().await.map_err(Self::error)?;
                }
                // The command has returned an exit code
                ChannelMsg::ExitStatus { exit_status } => {
                    code = Some(exit_status);
                    // cannot leave the loop immediately, there might still be more data to receive
                }
                _ => {}
            }
        }

        code.ok_or_else(|| Self::error("program did not exit cleanly"))
    }

    /// Close the session
    pub async fn close(&mut self) -> Result<()> {
        self.session
            .disconnect(Disconnect::ByApplication, "", "English")
            .await
            .map_err(Self::error)
    }

    /// Error helper
    fn error(e: impl ToString) -> SharedError {
        SharedError::Net(Net::Ssh(e.to_string()))
    }
}

pub mod tests {
    use super::*;

    pub const PRIVATE_KEY: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
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
-----END OPENSSH PRIVATE KEY-----
";

    pub fn get_ssh_config() -> SshConfig {
        SshConfig::new(
            "0.0.0.0".into(),
            2222,
            "root".into(),
            Some("password".into()),
            PRIVATE_KEY.into(),
            Some("password".into()),
        )
    }

    #[tokio::test]
    async fn test_ssh_connect() {
        let mut session = get_ssh_config().connect().await.unwrap();
        let result = session.call("ls -la").await.unwrap();
        println!("result: {result:?}");
    }
}
