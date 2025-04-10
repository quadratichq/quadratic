use std::net::SocketAddr;

use quadratic_rust_shared::net::{ssh::SshConfig, ssh_tunnel::SshTunnel};

use crate::error::Result;

pub(crate) async fn open_ssh_tunnel<'a>(
    config: SshConfig<'a>,
    host: &'a str,
    port: u16,
) -> Result<(SocketAddr, SshTunnel<'a>)> {
    let mut tunnel = SshTunnel::new(config, host.into(), port);
    let addr = tunnel.open().await?;

    Ok((addr, tunnel))
}

#[cfg(test)]
pub mod tests {
    use quadratic_rust_shared::net::ssh::tests::get_ssh_config;

    #[tokio::test]
    async fn test_ssh_connect() {
        let mut session = get_ssh_config().connect().await.unwrap();
        let result = session.call("ls -la").await.unwrap();
        assert_eq!(result, 0);
        println!("result: {:?}", result);
    }
}
