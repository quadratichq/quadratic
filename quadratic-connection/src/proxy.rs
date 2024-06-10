use std::time::Duration;

use axum::{
    body::Body,
    extract::Request,
    response::{IntoResponse, Response},
    Extension,
};
use http::{HeaderName, HeaderValue};
use reqwest::{Client, Method, RequestBuilder};

use crate::error::{proxy_error, ConnectionError, Result};
use crate::state::State;

const REQUEST_TIMEOUT_SEC: u64 = 15;
const PROXY_HEADER: &str = "proxy";

pub(crate) async fn axum_to_reqwest(
    url: &str,
    req: Request<Body>,
    client: Client,
) -> Result<RequestBuilder> {
    let method_bytes = req.method().as_str().as_bytes();
    let method = Method::from_bytes(method_bytes).map_err(proxy_error)?;

    let mut headers = reqwest::header::HeaderMap::with_capacity(req.headers().len());
    let headers_to_ignore = vec!["host", PROXY_HEADER, "authorization"];

    for (name, value) in req
        .headers()
        .into_iter()
        .filter(|(name, _)| !headers_to_ignore.contains(&name.as_str()))
    {
        let name = reqwest::header::HeaderName::from_bytes(name.as_ref()).map_err(proxy_error)?;
        let value =
            reqwest::header::HeaderValue::from_bytes(value.as_ref()).map_err(proxy_error)?;
        headers.insert(name, value);
    }

    let body = axum::body::to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(proxy_error)?;

    let reqwest = reqwest::Request::new(method, url.parse().map_err(proxy_error)?);
    let reqwest = reqwest::RequestBuilder::from_parts(client, reqwest)
        .headers(headers)
        .body(reqwest::Body::from(body))
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SEC));

    Ok(reqwest)
}

pub(crate) fn reqwest_to_axum(reqwest_response: reqwest::Response) -> Result<Response<Body>> {
    let mut response_builder = Response::builder().status(reqwest_response.status().as_u16());

    for (name, value) in reqwest_response.headers().into_iter() {
        let name = HeaderName::from_bytes(name.as_ref()).map_err(proxy_error)?;
        let value = HeaderValue::from_bytes(value.as_ref()).map_err(proxy_error)?;
        response_builder = response_builder.header(name, value);
    }

    let response = response_builder
        .body(Body::from_stream(reqwest_response.bytes_stream()))
        .map_err(proxy_error)?;

    Ok(response)
}

pub(crate) async fn proxy(
    state: Extension<State>,
    req: Request<Body>,
) -> Result<impl IntoResponse> {
    tracing::info!(?req);

    let headers = req.headers().clone();
    let url = headers
        .get(PROXY_HEADER)
        .ok_or_else(|| ConnectionError::Proxy("No proxy header found".to_string()))?
        .to_str()
        .map_err(proxy_error)?;

    let request_builder = axum_to_reqwest(url, req, state.client.clone()).await?;
    let reqwest_response = request_builder.send().await.map_err(proxy_error)?;

    let response = reqwest_to_axum(reqwest_response)?;

    Ok(response)
}
