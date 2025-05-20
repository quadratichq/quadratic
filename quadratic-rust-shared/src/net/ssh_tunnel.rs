//! SSH tunnel
//!
//! SSH tunnel implementation

use russh::Disconnect;
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use tokio::io::{AsyncWriteExt, copy_bidirectional_with_sizes};
use tokio::net::TcpListener;
use tokio::select;
use tokio::sync::watch::{Receiver, Sender, channel};

use crate::error::{Result, SharedError};

use super::error::Net;
use super::ssh::SshConfig;

/// SSH tunnel
///
/// A tunnel is a connection to a remote server that is used to forward
/// connections to the local server.
#[derive(Clone, Debug)]
pub struct SshTunnel {
    // The SSH config
    pub config: SshConfig,

    // The host and port to forward connections to
    pub forwarding_host: String,
    pub forwarding_port: u16,

    // The channel to send and receive messages on
    tx: Sender<u8>,
    rx: Receiver<u8>,

    // Whether the tunnel is connected
    is_connected: bool,
}

impl SshTunnel {
    /// Create a new SSH tunnel
    pub fn new(config: SshConfig, forwarding_host: String, forwarding_port: u16) -> Self {
        let (tx, rx) = channel::<u8>(1);

        Self {
            config,
            forwarding_host,
            forwarding_port,
            tx,
            rx,
            is_connected: false,
        }
    }

    /// Open the SSH tunnel
    pub async fn open(&mut self) -> Result<SocketAddr> {
        let ssh_client = self.config.to_owned().connect().await?;
        let forwarding_host = self.forwarding_host.to_string();
        let forwarding_port = self.forwarding_port as u32;
        let rx_clone = self.rx.clone();

        // bind to a random local port
        let listener = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0))
            .await
            .map_err(Self::error)?;
        let addr = listener.local_addr().map_err(Self::error)?;

        // listen for connections on the local port in a separate thread
        tokio::spawn(async move {
            loop {
                if let Ok((mut local_stream, _)) = listener.accept().await {
                    let channel = ssh_client
                        .session
                        .channel_open_direct_tcpip(
                            forwarding_host.clone(),
                            forwarding_port,
                            addr.ip().to_string(),
                            addr.port() as u32,
                        )
                        .await
                        .map_err(Self::error)?;

                    // clone the channel to send and receive messages on
                    // this is a cheap clone
                    let mut rx_clone_clone = rx_clone.clone();

                    // create a stream to send and receive messages on
                    let mut remote_stream = channel.into_stream();
                    let local_to_remote_buffer_size = 1024; // 1kb
                    let remote_to_local_buffer_size = 8 * 1024; // 8kb

                    tokio::spawn(async move {
                        select! {
                            // copy data between the local and remote streams
                            result = copy_bidirectional_with_sizes(&mut local_stream, &mut remote_stream, local_to_remote_buffer_size, remote_to_local_buffer_size) => {
                                if let Err(_e) = result {
                                    // ignore copy_bidirectional_with_sizes errors
                                }
                            }
                            // receive close signal, noop
                            _ = rx_clone_clone.changed() => {}
                        }
                        let _ = remote_stream.shutdown().await;
                    });
                }

                // if the channel has been closed, disconnect from the remote server
                if rx_clone.has_changed().map_err(Self::error)? {
                    ssh_client
                        .session
                        .disconnect(Disconnect::ByApplication, "exit", "none")
                        .await
                        .map_err(Self::error)?;
                    break;
                }
            }

            drop(listener);

            Ok::<(), SharedError>(())
        });

        self.is_connected = true;
        Ok(addr)
    }

    /// Close the SSH tunnel
    pub async fn close(&mut self) -> Result<()> {
        self.tx.send(0).map_err(Self::error)?;
        self.is_connected = false;
        Ok(())
    }

    /// Check if the SSH tunnel is connected    
    pub fn is_connected(&self) -> bool {
        self.is_connected
    }

    /// Error helper
    fn error(e: impl ToString) -> SharedError {
        SharedError::Net(Net::SshTunnel(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use tokio::net::TcpStream;

    use crate::net::ssh::tests::get_ssh_config;

    use super::*;

    #[tokio::test]
    async fn test_ssh_tunnel() {
        let config = get_ssh_config();
        let mut tunnel = SshTunnel::new(config, "localhost".into(), 1111);
        let addr = tunnel.open().await.unwrap();

        assert!(tunnel.is_connected());

        let mut client = TcpStream::connect(addr).await.unwrap();
        client.write_all(b"Hello, world!").await.unwrap();

        tunnel.close().await.unwrap();
    }
}
