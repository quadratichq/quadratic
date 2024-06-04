use std::iter::once;

use axum::{body::Body, extract::Request, response::IntoResponse, routing::get, Router};
use http::header::AUTHORIZATION;
use hyper::{body::Incoming, server::conn::http1, Method};
use hyper_util::{rt::TokioIo, service::TowerToHyperService};
use tower::{Service, ServiceBuilder, ServiceExt};
use tower_http::{
    auth::AsyncRequireAuthorizationLayer,
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    sensitive_headers::SetSensitiveHeadersLayer,
    trace::TraceLayer,
};

use super::proxy::upgrade;
use crate::{
    error::{ConnectionError, Result},
    proxy::auth::check_auth,
};

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

    let service_fn =
        tower::service_fn(move |request: Request<Incoming>| tower_service.clone().call(request));

    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}"))
        .await
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    tracing::info!("proxy server listening on {local_addr}");

    let cors = CorsLayer::new()
        // allow requests from any origin
        .allow_methods(Any)
        .allow_origin(Any)
        .allow_headers([AUTHORIZATION])
        .expose_headers(Any);

    loop {
        let (stream, _) = listener
            .accept()
            .await
            .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;
        let io = TokioIo::new(stream);

        let service = ServiceBuilder::new()
            //
            // log all http requests and responses
            .layer(TraceLayer::new_for_http())
            //
            // don't show authorization header in logs
            .layer(SetSensitiveHeadersLayer::new(once(AUTHORIZATION)))
            //
            // compress the response (currently using gzip)
            .layer(CompressionLayer::new())
            //
            // require authorization
            .layer(AsyncRequireAuthorizationLayer::new(
                |request: Request<Incoming>| async {
                    check_auth(request).await.map_err(|e| e.into_response())
                },
            ))
            .layer(cors.clone())
            //
            // convert to a serrvice
            .service(service_fn.clone());

        // convert from tower to hyper service
        let hyper_service = TowerToHyperService::new(service);

        tokio::task::spawn(async move {
            if let Err(err) = http1::Builder::new()
                .preserve_header_case(true)
                .title_case_headers(true)
                .serve_connection(io, hyper_service)
                .with_upgrades()
                .await
            {
                tracing::error!("Failed to serve connection: {:?}", err);
            }
        });
    }
}
