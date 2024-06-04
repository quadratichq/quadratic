use axum::extract::Request;
use http::header::AUTHORIZATION;
use hyper::body::Incoming;
use quadratic_rust_shared::auth::jwt::authorize;

use crate::{auth::Claims, error::Result, server::get_const_jwks};

pub(crate) async fn check_auth(request: Request<Incoming>) -> Result<Request<Incoming>> {
    let jwks = get_const_jwks().await;
    let token = request
        .headers()
        .get(&AUTHORIZATION).map(|header| header.to_str().unwrap_or_default().replace("Bearer ", ""));

    // we don't need any of the claims information, just validate the token
    if let Some(token) = token {
        authorize::<Claims>(jwks, &token, false, true)?;
    }

    Ok(request)
}
