use quadratic_rust_shared::{
    net::{ssh::SshConfig, ssh_tunnel::SshTunnel},
    sql::{Connection, UsesSsh},
};

use crate::error::{ConnectionError, Result};

pub(crate) async fn open_ssh_tunnel_for_connection<C>(
    connection: &mut C,
) -> Result<Option<SshTunnel>>
where
    C: Connection + Clone + UsesSsh,
    C: TryInto<SshConfig>,
    <C as TryInto<SshConfig>>::Error: Into<ConnectionError>,
{
    let use_ssh = connection.use_ssh();
    let mut ssh_tunnel: Option<SshTunnel> = None;

    if use_ssh {
        let forwarding_port = connection
            .port()
            .ok_or(ConnectionError::Ssh("Port is required".into()))??;

        let ssh_host = connection
            .ssh_host()
            .ok_or(ConnectionError::Ssh("SSH host is required".into()))?;

        let config = connection.clone().try_into().map_err(Into::into)?;
        let mut tunnel = SshTunnel::new(config, ssh_host, forwarding_port);
        let addr = tunnel.open().await?;

        connection.set_port(addr.port());
        ssh_tunnel = Some(tunnel);
    }

    Ok(ssh_tunnel)
}

// TODO(ddimara): keep this b/c I want to come back to finsih this to keep the
// other functions more DRY.
//
// pub(crate) async fn _process_in_ssh_tunnel<T, C, F, Fut>(connection: &mut C, func: F) -> Result<T>
// where
//     C: Connection + Clone + UsesSsh,
//     C: TryInto<SshConfig>,
//     <C as TryInto<SshConfig>>::Error: Into<ConnectionError>,
//     F: FnOnce() -> Fut,
//     Fut: std::future::Future<Output = Result<T>>,
// {
//     let ssh_tunnel = open_ssh_tunnel_for_connection::<C>(connection).await?;

//     let result = func().await?;

//     if let Some(mut ssh_tunnel) = ssh_tunnel {
//         ssh_tunnel.close().await?;
//     }

//     Ok(result)
// }

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
