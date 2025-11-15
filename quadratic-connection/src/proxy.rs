use std::sync::Arc;
use std::time::Duration;

use axum::{
    Extension,
    body::Body,
    extract::Request,
    response::{IntoResponse, Response},
};
use http::{HeaderName, HeaderValue};
use reqwest::{Client, Method, RequestBuilder};

use crate::error::{ConnectionError, Result, proxy_error};
use crate::state::State;

const REQUEST_TIMEOUT_SEC: u64 = 15;
const AUTHORIZATION_HEADER: &str = "authorization";
const PROXY_URL_HEADER: &str = "x-proxy-url";
const PROXY_HEADER_PREFIX: &str = "x-proxy-";

pub(crate) async fn axum_to_reqwest(
    url: &str,
    req: Request<Body>,
    client: Client,
) -> Result<RequestBuilder> {
    let method_bytes = req.method().as_str().as_bytes();
    let method = Method::from_bytes(method_bytes).map_err(proxy_error)?;

    let mut headers = reqwest::header::HeaderMap::with_capacity(req.headers().len());
    let headers_to_ignore = ["host", AUTHORIZATION_HEADER, PROXY_URL_HEADER];

    for (name, value) in req
        .headers()
        .into_iter()
        .filter(|(name, _)| !headers_to_ignore.contains(&name.as_str()))
        .map(|(name, value)| {
            let name = name.as_str();
            if let Some(name) = name.strip_prefix(PROXY_HEADER_PREFIX) {
                (name, value)
            } else {
                (name, value)
            }
        })
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
    state: Extension<Arc<State>>,
    req: Request<Body>,
) -> Result<impl IntoResponse> {
    tracing::info!(?req);

    let headers = req.headers().clone();
    let url = headers
        .get(PROXY_URL_HEADER)
        .ok_or_else(|| ConnectionError::Proxy("No proxy header found".to_string()))?
        .to_str()
        .map_err(proxy_error)?;

    let request_builder = axum_to_reqwest(url, req, state.client.clone()).await?;
    let reqwest_response = request_builder.send().await.map_err(proxy_error)?;

    let response = reqwest_to_axum(reqwest_response)?;

    Ok(response)
}

#[cfg(test)]
mod tests {

    use http::header::ACCEPT;

    use super::*;
    use crate::test_util::{new_state, response_bytes};

    const URL: &str = "https://www.google.com/";

    #[tokio::test]
    async fn proxy_request() {
        let state = Extension(Arc::new(new_state().await));
        let mut request = Request::new(Body::empty());
        request
            .headers_mut()
            .insert(PROXY_URL_HEADER, HeaderValue::from_static(URL));
        let data = proxy(state, request).await.unwrap();
        let response = data.into_response();

        assert_eq!(response.status(), 200);
        assert_ne!(response_bytes(response).await.len(), 0);
    }

    #[tokio::test]
    async fn proxy_axum_to_reqwest() {
        let state = Arc::new(new_state().await);
        let accept = "application/json";
        let mut request = Request::new(Body::empty());
        *request.method_mut() = http::Method::POST;
        request
            .headers_mut()
            .insert(ACCEPT, HeaderValue::from_static(accept));
        request
            .headers_mut()
            .insert(PROXY_URL_HEADER, HeaderValue::from_static(URL));

        let result = axum_to_reqwest(URL, request, state.client.clone())
            .await
            .unwrap()
            .build()
            .unwrap();

        assert_eq!(result.method(), Method::POST);
        assert_eq!(result.url().to_string(), URL);

        // PROXY_URL_HEADER doesn't get copied over
        assert_eq!(result.headers().len(), 1);
        assert_eq!(
            result.headers().get(reqwest::header::ACCEPT).unwrap(),
            accept
        );
    }
}
