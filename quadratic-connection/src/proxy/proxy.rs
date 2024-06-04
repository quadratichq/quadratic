use axum::{
    body::Body,
    extract::Request,
    response::{IntoResponse, Response},
};
use hyper::{upgrade::Upgraded, StatusCode};
use hyper_util::rt::TokioIo;
use tokio::{io::copy_bidirectional, net::TcpStream};

use crate::error::{ConnectionError, Result};

/// Upgrade the connection in a separate thread
pub(crate) async fn upgrade(req: Request<Body>) -> Result<Response> {
    tracing::info!(?req);

    if let Some(host_addr) = req.uri().authority().map(|auth| auth.to_string()) {
        tokio::task::spawn(async move {
            if let Err(e) = match hyper::upgrade::on(req).await {
                Ok(upgraded) => tunnel(upgraded, host_addr).await,
                Err(e) => Err(ConnectionError::Proxy(e.to_string())),
            } {
                tracing::error!("Error upgrading: {:?}", e);
            }
        });

        Ok(Response::new(Body::empty()))
    } else {
        let error = format!("CONNECT host is not socket addr: {:?}", req.uri());
        let response = (StatusCode::BAD_REQUEST, error.to_owned());

        tracing::warn!(error);

        Ok(response.into_response())
    }
}

async fn tunnel(upgraded: Upgraded, addr: String) -> Result<()> {
    let mut server = TcpStream::connect(addr)
        .await
        .map_err(|e| ConnectionError::Proxy(e.to_string()))?;

    let mut upgraded = TokioIo::new(upgraded);

    // an error is expected on a macOS machine using localhost: https://github.com/tokio-rs/tokio/issues/4674
    // ignore the error as it is not a problem
    let (from_client, from_server) = copy_bidirectional(&mut upgraded, &mut server)
        .await
        .map_err(|e| ConnectionError::Proxy(e.to_string()))?;

    tracing::trace!(
        "Client wrote {} bytes and received {} bytes",
        from_client,
        from_server
    );

    Ok(())
}
