use std::iter::once;

use axum::{
    body::Body,
    extract::Request,
    response::IntoResponse,
    routing::{any, get},
    Router,
};
use http::{header::AUTHORIZATION, HeaderName};
use hyper::{body::Incoming, server::conn::http1, Method};
use hyper_util::{rt::TokioIo, service::TowerToHyperService};
use reqwest::{redirect::Policy, Client};
use tower::{Service, ServiceBuilder, ServiceExt};
use tower_http::{
    auth::AsyncRequireAuthorizationLayer,
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    sensitive_headers::SetSensitiveHeadersLayer,
    trace::TraceLayer,
};

use super::tunnel::upgrade;
use crate::{
    error::{ConnectionError, Result},
    proxy::{auth::check_auth, browser::proxy_browser, proxy_error},
};

pub(crate) async fn serve(host: &str, port: u16) -> Result<()> {
    let client = Client::builder()
        .cookie_store(true)
        .redirect(Policy::limited(5))
        .build()
        .map_err(proxy_error)?;

    let router_service = Router::new()
        .route("/", get(|| async { "This is ignored" }))
        .route("/browser", any(proxy_browser))
        .with_state(client);

    let tower_service = tower::service_fn(move |req: Request<_>| {
        let router_service = router_service.clone();
        let request = req.map(Body::new);

        // // hack to see if we can force an upgrade
        // *request.method_mut() = Method::CONNECT;
        // *request.uri_mut() = "tokio.rs:443".parse().map_err(proxy_error)?;

        // request
        //     .headers_mut()
        //     .insert(HOST, HeaderValue::from_str("tokio.rs:443").map_err(proxy_error)?)
        //     .map_err(proxy_error)?;

        // request
        //     .headers_mut()
        //     .insert(CONNECTION, HeaderValue::from_str("keep-alive").map_err(proxy_error)?)
        //     .map_err(proxy_error)?;

        // request.headers_mut().insert(
        //     "proxy-connection",
        //     HeaderValue::from_str("keep-alive").map_err(proxy_error)?,
        // );

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
        .allow_headers([AUTHORIZATION, HeaderName::from_static("proxy")])
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
