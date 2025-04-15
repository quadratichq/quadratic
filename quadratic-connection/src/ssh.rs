use std::net::SocketAddr;

use quadratic_rust_shared::{
    net::{ssh::SshConfig, ssh_tunnel::SshTunnel},
    sql::{Connection, UsesSsh, postgres_connection::PostgresConnection},
};

use crate::error::{ConnectionError, Result};

pub(crate) async fn open_ssh_tunnel<'a>(
    config: SshConfig<'a>,
    host: &'a str,
    port: u16,
) -> Result<(SocketAddr, SshTunnel<'a>)> {
    let mut tunnel = SshTunnel::new(config, host.into(), port);
    let addr = tunnel.open().await?;

    Ok((addr, tunnel))
}

pub(crate) async fn process_in_ssh_tunnel<T, C>(
    connection: &mut C,
    func: impl FnOnce() -> Result<T>,
) -> Result<T>
where
    C: Connection + Clone,
    for<'a> &'a C: TryInto<SshConfig<'a>>,
    for<'a> <&'a C as TryInto<SshConfig<'a>>>::Error: Into<ConnectionError>,
    C: UsesSsh,
{
    let use_ssh = connection.use_ssh();
    let mut ssh_tunnel: Option<SshTunnel> = None;
    let connection_for_ssh = connection.clone();

    if use_ssh {
        let ssh_config = (&connection_for_ssh).try_into().map_err(Into::into)?;
        let forwarding_port = connection
            .port()
            .clone()
            .ok_or(ConnectionError::Ssh("Port is required".into()))??;
        let ssh_host = connection_for_ssh
            .ssh_host()
            .ok_or(ConnectionError::Ssh("SSH host is required".into()))?;
        let (addr, tunnel) = open_ssh_tunnel(ssh_config, ssh_host, forwarding_port).await?;

        connection.set_port(addr.port());
        ssh_tunnel = Some(tunnel);
    }

    let result = func()?;

    if let Some(mut ssh_tunnel) = ssh_tunnel {
        ssh_tunnel.close().await?;
    }

    Ok(result)
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
