use axum::{body::Body, extract::Request, routing::get, Router};
use hyper::{body::Incoming, server::conn::http1, Method};
use hyper_util::rt::TokioIo;
use tower::{Service, ServiceBuilder, ServiceExt};

use crate::error::{ConnectionError, Result};
use crate::proxy::helpers::upgrade;

pub(crate) async fn serve(host: &str, port: u16) -> Result<()> {
    let router_service = Router::new().route("/", get(|| async { "This is ignored" }));

    let tower_service = tower::service_fn(move |req: Request<_>| {
        let router_service = router_service.clone();
        let request = req.map(Body::new);

        async move {
            if request.method() == Method::CONNECT {
                upgrade(request).await
            } else {
                router_service
                    .oneshot(request)
                    .await
                    .map_err(|e| ConnectionError::Proxy(e.to_string()))
            }
        }
    });

    let service_fn = hyper::service::service_fn(move |request: Request<Incoming>| {
        tower_service.clone().call(request)
    });

    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}"))
        .await
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    tracing::info!("proxy server listening on {local_addr}");

    loop {
        let (stream, _) = listener
            .accept()
            .await
            .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;
        let io = TokioIo::new(stream);
        let service = ServiceBuilder::new().service(service_fn.clone());

        tokio::task::spawn(async move {
            if let Err(err) = http1::Builder::new()
                .preserve_header_case(true)
                .title_case_headers(true)
                .serve_connection(io, service)
                .with_upgrades()
                .await
            {
                tracing::error!("Failed to serve connection: {:?}", err);
            }
        });
    }
}
