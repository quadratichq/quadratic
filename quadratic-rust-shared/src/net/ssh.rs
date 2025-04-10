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

#[derive(Debug, Clone)]
pub struct SshConfig<'a> {
    host: &'a str,
    port: u16,
    username: &'a str,
    password: Option<&'a str>,
    private_key: &'a str,
    private_key_password: Option<&'a str>,
    openssh_certificate: Option<&'a str>,
}

impl<'a> SshConfig<'a> {
    /// Create a new SSH config
    pub fn new(
        host: &'a str,
        port: u16,
        username: &'a str,
        password: Option<&'a str>,
        private_key: &'a str,
        private_key_password: Option<&'a str>,
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
    pub async fn connect(&self) -> Result<Session> {
        Session::connect(
            &self.private_key,
            self.private_key_password,
            &self.username,
            self.password,
            self.openssh_certificate,
            (self.host, self.port),
        )
        .await
    }
}

pub struct Client;

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

pub struct Session {
    pub session: Handle<Client>,
}

impl Session {
    /// Configure the session
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
        key: &str,
        key_password: Option<&str>,
        user: &str,
        _password: Option<&str>,
        openssh_cert_plain: Option<&str>,
        addrs: A,
    ) -> Result<Self> {
        let key_pair = decode_secret_key(key, key_password).map_err(Self::error)?;

        // load ssh certificate
        let mut openssh_cert = None;
        if let Some(openssh_cert_plain) = openssh_cert_plain {
            openssh_cert = Some(load_openssh_certificate(openssh_cert_plain).map_err(Self::error)?);
        }

        let config = Arc::new(Self::config());
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

        Ok(code.ok_or_else(|| Self::error("program did not exit cleanly"))?)
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
VWluqmDlhVpF8Go3CWF0CRv4w=
-----END OPENSSH PRIVATE KEY-----
";

    pub fn get_ssh_config() -> SshConfig<'static> {
        SshConfig {
            host: "localhost".into(),
            port: 2222,
            username: "root".into(),
            password: Some("password".into()),
            private_key: PRIVATE_KEY.into(),
            private_key_password: Some("password".into()),
            openssh_certificate: None,
        }
    }

    #[tokio::test]
    async fn test_ssh_connect() {
        let mut session = get_ssh_config().connect().await.unwrap();
        let result = session.call("ls -la").await.unwrap();
        println!("result: {:?}", result);
    }
}
