//! JWT Authentication
//!
//! Functions to interact with JWT tokens

use http::HeaderMap;
use jsonwebtoken::jwk::{AlgorithmParameters, JwkSet};
use jsonwebtoken::{
    Algorithm, DecodingKey, Header, TokenData, Validation, decode, decode_header, jwk,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tokio::sync::OnceCell;

use crate::auth::error::Auth;
use crate::error::{Result, SharedError};

pub static JWKS: OnceCell<JwkSet> = OnceCell::const_new();

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub email: String,
    pub exp: usize,
}

/// Get the constant JWKS for use throughout the application
/// The panics are intentional and will happen at startup
pub async fn get_const_jwks(jwks_uri: &str) -> &'static JwkSet {
    JWKS.get_or_init(|| async { get_jwks(jwks_uri).await.expect("Unable to get JWKS") })
        .await
}

/// Get the JWK set from a given URL.
pub async fn get_jwks(url: &str) -> Result<jwk::JwkSet> {
    let jwks = reqwest::get(url).await?.json::<jwk::JwkSet>().await?;
    Ok(jwks)
}

/// Authorize a JWT token using a given JWK set.
pub fn authorize<S>(
    jwks: &jwk::JwkSet,
    token: &str,
    validate_aud: bool,
    validate_exp: bool,
) -> Result<TokenData<S>>
where
    S: DeserializeOwned,
{
    let header = decode_header(token)?;
    let decoded_token;
    let kid = header.kid.ok_or_else(|| {
        SharedError::Auth(Auth::Jwt("Token doesn't have a `kid` header field".into()))
    })?;

    // Validate the JWT using an algorithm.  The algorithm needs to be RSA.
    if let Some(jwk) = jwks.find(&kid) {
        match &jwk.algorithm {
            AlgorithmParameters::RSA(rsa) => {
                let decoding_key = DecodingKey::from_rsa_components(&rsa.n, &rsa.e)?;
                let key_algorithm = jwk
                    .common
                    .key_algorithm
                    .ok_or_else(|| SharedError::Auth(Auth::Jwt("Invalid key algorithm".into())))?
                    .to_string();

                let mut validation = Validation::new(Algorithm::from_str(&key_algorithm)?);
                validation.validate_exp = validate_exp;
                validation.validate_aud = validate_aud;

                decoded_token = decode::<S>(token, &decoding_key, &validation)?;
            }
            _ => {
                return Err(SharedError::Auth(Auth::Jwt(
                    "Unsupported algorithm, should be RSA".into(),
                )));
            }
        }
    } else {
        return Err(SharedError::Auth(Auth::Jwt(
            "No matching JWK found for the given kid".into(),
        )));
    }

    Ok(decoded_token)
}

/// Check if the connection is m2m service connection is valid
pub fn authorize_m2m(headers: &HeaderMap, expected_token: &str) -> Result<TokenData<Claims>> {
    let token = extract_m2m_token(headers)
        .ok_or_else(|| SharedError::Auth(Auth::Jwt("No m2m token found".into())))?;

    if token != expected_token {
        return Err(SharedError::Auth(Auth::Jwt("Invalid m2m token".into())));
    }

    Ok(TokenData {
        header: Header::default(),
        claims: Claims {
            email: "m2m@quadratic.com".into(),
            exp: 0,
        },
    })
}

/// Extract the authorization token from the headers, removing the "Bearer " prefix.
pub fn extract_m2m_token(headers: &HeaderMap) -> Option<String> {
    headers.get("authorization").map_or(None, |authorization| {
        authorization
            .to_str()
            .ok()
            .map(|s| s.to_string().replace("Bearer ", ""))
    })
}

pub mod tests {
    #![allow(unused)]
    use super::*;

    pub const TOKEN: &str = "eyJhbGciOiJSUzI1NiIsImtpZCI6InNzb19vaWRjX2tleV9wYWlyXzAxSlhXUjc4NlBGVjJUNkZBQU5NQ0tGOFRUIn0.eyJlbWFpbCI6ImF5dXNoQGdtYWlsLmNvbSIsImlzcyI6Imh0dHBzOi8vYXBpLndvcmtvcy5jb20vdXNlcl9tYW5hZ2VtZW50L2NsaWVudF8wMUpYV1I3OEcxUlM5NDNTSlpHOUc5S0ZEVyIsInN1YiI6InVzZXJfMDFLNEVaQzYzMUdHSEZLQjVWWEVBUlBCMEciLCJzaWQiOiJzZXNzaW9uXzAxSzRFWkM2UFlTRUI1SldTS0ZEWkZHV0RCIiwianRpIjoiMDFLNEVaQ0pZRjkxNzk3Rk1HMTUyRFc0OEgiLCJleHAiOjE3NTcxNDQ2MDQsImlhdCI6MTc1NzE0NDMwNH0.g22z76GKyuKctRZ4FPzWvEbNAOC1yEvnHCzSVRp7x58vfAo1X8qjXfI7sNNHHK6HsDMKjX6OOl74g1rjGTlSPc5kJYeoU6BLpB3Y_WamAe3YranIE5oxbhU37MJiOYoyHF9gZA08sJVH0T20rTDigPitlX3H1FpLMX_iQRAblLJalgrtgQgYpyKLc354n2k_YXcJD_6j8wVFn93DSJYeyQONSwl5BTftYDO-vvz0k3nIpQpPsgjzDy-SsNDkJFNHpcEFdIh2FQkQT2JDUjmIfhijYeMCy9VoSxCP17La6ErTvZh8gCeyEw2XRIktK3xt58BOxQvsVrtXXuoW0y9Kag";
    const JWKS: &str = r#"
{"keys":[{"alg":"RS256","kty":"RSA","use":"sig","n":"ySkMIsTmVZKVQBNSM5gOolK2R-vhPfPNZGSYmYQnJ56eZ4E_0UzsLZDsxkdGXJPUThR_Vnny5rCKdAzZpUKN_5DQansPph8tDexqRnDi1_LNYsIGE6FkqN7Hc3I3hvdB47juxDX5MRWAEzxohgxUsXP1QMFA3RXmBF_LVk8KEDYaUL9uNhAPzAngqHVhuT1jBioTX-5J63EsGR67tYvi9YgG13At0X3Jqn1TSt3I4VaMHdzoiUXG_vmMIfRt9sL-xuufH-cfH4sQxl1h0N7vmOYxdMQ_lg0Hn77Rrz2gxhZT6wWGzntMes1Hqqt7409F9EDhKDtY0nYoF0WL1_MkvQ","e":"AQAB","kid":"sso_oidc_key_pair_01JXWR786PFV2T6FAANMCKF8TT","x5c":["MIICvjCCAaagAwIBAgISQAAAZd5g6CCkXnvRCNjyGLSKMA0GCSqGSIb3DQEBBQUAMBoxGDAWBgNVBAMTD2F1dGgud29ya29zLmNvbTAeFw0yNTA2MTYxNjEyMzhaFw0zMDA2MTYxNjEyMzhaMBoxGDAWBgNVBAMTD2F1dGgud29ya29zLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMkpDCLE5lWSlUATUjOYDqJStkfr4T3zzWRkmJmEJyeenmeBP9FM7C2Q7MZHRlyT1E4Uf1Z58uawinQM2aVCjf+Q0Gp7D6YfLQ3sakZw4tfyzWLCBhOhZKjex3NyN4b3QeO47sQ1+TEVgBM8aIYMVLFz9UDBQN0V5gRfy1ZPChA2GlC/bjYQD8wJ4Kh1Ybk9YwYqE1/uSetxLBkeu7WL4vWIBtdwLdF9yap9U0rdyOFWjB3c6IlFxv75jCH0bfbC/sbrnx/nHx+LEMZdYdDe75jmMXTEP5YNB5++0a89oMYWU+sFhs57THrNR6qre+NPRfRA4Sg7WNJ2KBdFi9fzJL0CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAFtp51+LIN+OtiC3GUm6HDnAXI5kZYIqiEd2H8dZCaToOclM9Rm2CJoRBqSln+Cafxle+uxxhhCcRlYSfQbGTYfASTWpeYs0tF8ErNIj2JeqLIVM1A/cxn/YMuF3QlS+jWsKrlxY4pMoAJzDsd89iA26pHcrxNyo0+u534epmDcCdJfYb+4frCJxb22Ed8BPsge48v8p8tVZshz0EGw8S42d1xv/CcS22W2JgZ8hcmAbkOt/UCzibEKxoX9k1Ti6fK9LZF6bItWfU56hCbfohHZkn6MtGmQIM3/U8UpBTwGqRbxWDHjmJYrHZdP84xkoVCCR/1R9k9F6/ptXCyfzRIw=="],"x5t#S256":"sAUTaak7Lq3Fzk7iC05UFzpG7NJcOLTjbEiLN02VJs4"}]}
"#;

    #[derive(Debug, Serialize, Deserialize)]
    pub struct Claims {
        email: String,
        exp: usize,
    }

    #[tokio::test]
    async fn test_authorize() {
        let jwks: jwk::JwkSet = serde_json::from_str(JWKS).unwrap();
        let result = authorize::<Claims>(&jwks, TOKEN, false, false);
        assert!(result.is_ok());

        // past expiration causes error
        let result = authorize::<Claims>(&jwks, TOKEN, false, true);
        assert_eq!(
            result.unwrap_err(),
            SharedError::Auth(Auth::Jwt("ExpiredSignature".into()))
        );
    }
}
