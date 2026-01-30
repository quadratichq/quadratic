//! JWT Authentication
//!
//! Functions to interact with JWT tokens

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use http::HeaderMap;
use jsonwebtoken::jwk::{
    AlgorithmParameters, CommonParameters, Jwk, JwkSet, KeyAlgorithm, PublicKeyUse, RSAKeyParameters, RSAKeyType,
};
use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, TokenData, Validation, decode, decode_header,
    encode, jwk,
};
use rsa::pkcs1::DecodeRsaPrivateKey;
use rsa::traits::PublicKeyParts;
use rsa::RsaPrivateKey;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tokio::sync::OnceCell;
use uuid::Uuid;

use crate::auth::error::Auth;
use crate::error::{Result, SharedError};

pub static JWKS: OnceCell<JwkSet> = OnceCell::const_new();

/// Claims for a JWT token
///
/// This is the claims that are included in the JWT token.
/// The email is the email of the user who is authenticated.
/// The exp is the expiration time of the JWT token.
/// The file_id is an optional file identifier for file-scoped tokens.
/// The team_id is an optional team identifier for team-scoped tokens.
/// The jti is an optional unique identifier for one-time use tokens.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Claims {
    pub email: String,
    pub exp: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub jti: Option<String>,
}

impl Claims {
    pub fn new(
        email: String,
        exp_seconds: usize,
        file_id: Option<Uuid>,
        team_id: Option<Uuid>,
    ) -> Self {
        let exp = (chrono::Utc::now() + chrono::Duration::seconds(exp_seconds as i64)).timestamp()
            as usize;

        Self {
            email,
            exp,
            file_id,
            team_id,
            jti: None,
        }
    }

    /// Create claims for a one-time use token with a unique jti
    pub fn new_one_time(
        email: String,
        exp_seconds: usize,
        file_id: Option<Uuid>,
        team_id: Option<Uuid>,
    ) -> Self {
        let exp = (chrono::Utc::now() + chrono::Duration::seconds(exp_seconds as i64)).timestamp()
            as usize;

        Self {
            email,
            exp,
            file_id,
            team_id,
            jti: Some(Uuid::new_v4().to_string()),
        }
    }
}

/// Generate a JWT token with the specified key ID (kid) for JWKS-based validation
pub fn generate_jwt<T: Serialize>(
    claims: T,
    kid: &str,
    encoding_key: &EncodingKey,
) -> Result<String> {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(kid.to_string());
    encode(&header, &claims, encoding_key)
        .map_err(|e| SharedError::Auth(Auth::Jwt(format!("Failed to encode worker JWT: {}", e))))
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

/// Parse a JWKS from a JSON string.
pub fn parse_jwks(jwks_json: &str) -> Result<jwk::JwkSet> {
    let jwks_unescaped = jwks_json.replace("\\\"", "\"");

    serde_json::from_str(&jwks_unescaped)
        .map_err(|e| SharedError::Auth(Auth::Jwt(format!("Failed to parse JWKS: {}", e))))
}

/// Derive a JWKS from a private key PEM string.
///
/// This extracts the public key components (modulus n, exponent e) from the
/// private key and constructs a JWK with the given key ID.
///
/// This allows configuring only the private key and automatically deriving
/// the matching public key for JWT validation, eliminating key mismatch issues.
pub fn jwks_from_private_key_pem(private_key_pem: &str, kid: &str) -> Result<JwkSet> {
    // Normalize the PEM (handle escaped newlines)
    let pem_normalized = private_key_pem.replace("\\n", "\n");

    // Try parsing as PKCS#1 (RSA PRIVATE KEY) first, then PKCS#8 (PRIVATE KEY)
    let private_key = RsaPrivateKey::from_pkcs1_pem(&pem_normalized)
        .or_else(|_| {
            use rsa::pkcs8::DecodePrivateKey;
            RsaPrivateKey::from_pkcs8_pem(&pem_normalized)
        })
        .map_err(|e| SharedError::Auth(Auth::Jwt(format!("Failed to parse private key PEM: {}", e))))?;

    // Extract public key components
    let public_key = private_key.to_public_key();
    let n_bytes = public_key.n().to_bytes_be();
    let e_bytes = public_key.e().to_bytes_be();

    // Base64url encode the components (no padding)
    let n_base64 = URL_SAFE_NO_PAD.encode(&n_bytes);
    let e_base64 = URL_SAFE_NO_PAD.encode(&e_bytes);

    // Build the JWK
    let jwk = Jwk {
        common: CommonParameters {
            public_key_use: Some(PublicKeyUse::Signature),
            key_operations: None,
            key_algorithm: Some(KeyAlgorithm::RS256),
            key_id: Some(kid.to_string()),
            x509_url: None,
            x509_chain: None,
            x509_sha1_fingerprint: None,
            x509_sha256_fingerprint: None,
        },
        algorithm: AlgorithmParameters::RSA(RSAKeyParameters {
            key_type: RSAKeyType::RSA,
            n: n_base64,
            e: e_base64,
        }),
    };

    Ok(JwkSet { keys: vec![jwk] })
}

/// Merge multiple JWKS into one. Keys from later JWKS will be appended.
pub fn merge_jwks(base: jwk::JwkSet, additional: jwk::JwkSet) -> jwk::JwkSet {
    let mut keys = base.keys;
    keys.extend(additional.keys);
    jwk::JwkSet { keys }
}

/// Get the kid from the JWKS.
pub fn get_kid_from_jwks(jwks: &jwk::JwkSet) -> Result<String> {
    let kid = jwks
        .keys
        .iter()
        .find(|jwk| jwk.common.key_id.is_some())
        .and_then(|jwk| jwk.common.key_id.clone())
        .ok_or_else(|| SharedError::Auth(Auth::Jwt("No kid found in JWKS".into())))?;

    Ok(kid)
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
        let jwks_kids = jwks
            .keys
            .iter()
            .filter_map(|jwk| jwk.common.key_id.as_deref())
            .collect::<Vec<_>>()
            .join(", ");
        return Err(SharedError::Auth(Auth::Jwt(format!(
            "No matching JWK found for the given kid. JWT kid: {kid}, JWKS kids: {jwks_kids}",
        ))));
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

    // M2M tokens are validated by string comparison, not JWT claims,
    // but we use a long expiration to avoid confusion if claims are inspected
    Ok(TokenData {
        header: Header::default(),
        claims: Claims::new("m2m@quadratic.com".into(), 86400 * 365, None, None), // 1 year
    })
}

/// Extract the authorization token from the headers, removing the "Bearer " prefix.
pub fn extract_m2m_token(headers: &HeaderMap) -> Option<String> {
    headers.get("authorization").and_then(|authorization| {
        authorization
            .to_str()
            .ok()
            .map(|s| s.to_string().replace("Bearer ", ""))
    })
}

pub mod tests {
    #![allow(unused)]
    use http::HeaderValue;

    use super::*;

    pub const TOKEN: &str = "eyJhbGciOiJSUzI1NiIsImtpZCI6InNzb19vaWRjX2tleV9wYWlyXzAxSlhXUjc4NlBGVjJUNkZBQU5NQ0tGOFRUIn0.eyJlbWFpbCI6ImF5dXNoQGdtYWlsLmNvbSIsImlzcyI6Imh0dHBzOi8vYXBpLndvcmtvcy5jb20vdXNlcl9tYW5hZ2VtZW50L2NsaWVudF8wMUpYV1I3OEcxUlM5NDNTSlpHOUc5S0ZEVyIsInN1YiI6InVzZXJfMDFLNEVaQzYzMUdHSEZLQjVWWEVBUlBCMEciLCJzaWQiOiJzZXNzaW9uXzAxSzRFWkM2UFlTRUI1SldTS0ZEWkZHV0RCIiwianRpIjoiMDFLNEVaQ0pZRjkxNzk3Rk1HMTUyRFc0OEgiLCJleHAiOjE3NTcxNDQ2MDQsImlhdCI6MTc1NzE0NDMwNH0.g22z76GKyuKctRZ4FPzWvEbNAOC1yEvnHCzSVRp7x58vfAo1X8qjXfI7sNNHHK6HsDMKjX6OOl74g1rjGTlSPc5kJYeoU6BLpB3Y_WamAe3YranIE5oxbhU37MJiOYoyHF9gZA08sJVH0T20rTDigPitlX3H1FpLMX_iQRAblLJalgrtgQgYpyKLc354n2k_YXcJD_6j8wVFn93DSJYeyQONSwl5BTftYDO-vvz0k3nIpQpPsgjzDy-SsNDkJFNHpcEFdIh2FQkQT2JDUjmIfhijYeMCy9VoSxCP17La6ErTvZh8gCeyEw2XRIktK3xt58BOxQvsVrtXXuoW0y9Kag";
    pub const TEST_PRIVATE_KEY: &str = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA41CuyduJst/Uz3jfGCwwDVK2OpepauDdTyVPr31xygt9OvJ8\npnvWeqwiyNvBXra5rgH12qtKlUeSKm4jBDcHKu9qLLRuCQ1Hw2Fqieo5rcdK4mLO\nm0TxPPJ+nPaaNaDtwDFDlpPOBvAX/GJfyIShgFxy7qxq1G4qc/hMKvGVsUnIAJem\nWqo8AquYQ4Jali+YIgDGBZfchzJZbIC8IxU1JLM6CpkZ5cJtrpcdtz2TEu8omHee\njU2E8fSd/Lz2By+BObFromnmQL60i7OaVHYRL6XGFtF4dXEETe05db6fNgRbYjJK\n7TBM9Eavrz3C/lvs1GClnV3+me2ZTM3YTktRNwIDAQABAoIBAQCHXX2o4V5/scE2\nB8G60F2RIYc5HyWZauz/e7WXSLmhWvQpTUujjK1tgeJ5ADyH3YJ3N92jaUvR17wY\nHlwl32saS1ZL5up743evxuw90sikTsCuTa7BUe3ioHl7mXK9qubKA8w++CfBg+qU\ntjRZ4XmXSfZ7YRuBA1Wul9cr34+H8ctgaYi2yJQeVj8ZGlMfaC2bH7zFIATDgjPr\n+x/Dw3AljlsDU4RD97Ta85SuLuFYVPStE4M3FCgipHL73US4Zw6oQgQ5tZgw4sH3\ncL9I+0Asx5QGtnKHgAeZdFW4G0+cExryOx32RhN3onrRsA52mjydG6bVFCntcV/e\nLuzNvGHhAoGBAPvRhRtuDb8sgMKZsGAysnJFiTyPLtmG6RYeOgg+WmQe2NSfttVE\n7BQCxl7RGiy1F/R15RzrApklm9s6LcLx77mjHtMCFOtF3SS2gBOywdds179EWb0r\npH1XzGLyRP3aFTAvin4BhiBznkcduNwXhVZO4+Db9b2EJwGArsD1dkVxAoGBAOcW\n/9qJG3zqddBp1eLXcLROgK6DCD0/HtU1eWPeGMGuGkGeFZYRkETi2pS1nRAqfYwq\nBdCj1plW3HP26NoPDUOZ5oXJ/i9Xgk4LsYRnNydIUCtsLm1J8+P1sHBQDfT8BAIi\nABWXZNCSfLFMvIT9R8xLYYv6SrJiZw62RC+DwA0nAoGAS9hISgG0vD7QLUyS9fZv\nDsHo2seZacUbkSDbg74cBYnQ7wGH1OZkYIaRbt92Db8hjuyvbC1QZAYS0k3MmKm7\n9WKvFwjKei5ZtAQPwV8WySasOJyCltp9OY9nLOohY3/637+B6//TgRSxuGO4WPnw\nnBU4x3IYqtMR2H8Eo3OLAtECgYBVJtduWnlDhU2WV3lV1hcUiZzHMUdW8ixVWhf5\n4bvzmkjYhvzjSGOFzqXGiElwzIdon492+vg3lpczL/dLaqJzl4EnKXA9V5yPT6XA\n6RucoPvRlFJjOQ3ioQS7zfPmovqDIq4vRpMCfAfweRs6Ue4j7F7sanUd2D6rYCQt\n8flRnwKBgQCh8h23uEz7us+H5TWf8f9r/raot/JiC3klV6Oe0Dcc7t65b2uO0eft\nzn0UZTodY/7Zx4KXw5pshjnfAbYVIOX+W0Nyc2IHtg+7uFjYyajWjxFTV4BFPT3B\nLu6BiebsCPVoGOaynxvdWF9A5aCPveVQ0VvwitFpXRvFlvkrpgus9A==\n-----END RSA PRIVATE KEY-----\n";
    pub const TEST_JWKS: &str = r#"{"keys":[{"alg":"RS256","kty":"RSA","use":"sig","n":"41CuyduJst_Uz3jfGCwwDVK2OpepauDdTyVPr31xygt9OvJ8pnvWeqwiyNvBXra5rgH12qtKlUeSKm4jBDcHKu9qLLRuCQ1Hw2Fqieo5rcdK4mLOm0TxPPJ-nPaaNaDtwDFDlpPOBvAX_GJfyIShgFxy7qxq1G4qc_hMKvGVsUnIAJemWqo8AquYQ4Jali-YIgDGBZfchzJZbIC8IxU1JLM6CpkZ5cJtrpcdtz2TEu8omHeejU2E8fSd_Lz2By-BObFromnmQL60i7OaVHYRL6XGFtF4dXEETe05db6fNgRbYjJK7TBM9Eavrz3C_lvs1GClnV3-me2ZTM3YTktRNw","e":"AQAB","kid":"test_key_id"}]}"#;
    pub const TEST_KID: &str = "test_key_id";
    pub const JWKS: &str = r#"
{"keys":[{"alg":"RS256","kty":"RSA","use":"sig","n":"ySkMIsTmVZKVQBNSM5gOolK2R-vhPfPNZGSYmYQnJ56eZ4E_0UzsLZDsxkdGXJPUThR_Vnny5rCKdAzZpUKN_5DQansPph8tDexqRnDi1_LNYsIGE6FkqN7Hc3I3hvdB47juxDX5MRWAEzxohgxUsXP1QMFA3RXmBF_LVk8KEDYaUL9uNhAPzAngqHVhuT1jBioTX-5J63EsGR67tYvi9YgG13At0X3Jqn1TSt3I4VaMHdzoiUXG_vmMIfRt9sL-xuufH-cfH4sQxl1h0N7vmOYxdMQ_lg0Hn77Rrz2gxhZT6wWGzntMes1Hqqt7409F9EDhKDtY0nYoF0WL1_MkvQ","e":"AQAB","kid":"sso_oidc_key_pair_01JXWR786PFV2T6FAANMCKF8TT","x5c":["MIICvjCCAaagAwIBAgISQAAAZd5g6CCkXnvRCNjyGLSKMA0GCSqGSIb3DQEBBQUAMBoxGDAWBgNVBAMTD2F1dGgud29ya29zLmNvbTAeFw0yNTA2MTYxNjEyMzhaFw0zMDA2MTYxNjEyMzhaMBoxGDAWBgNVBAMTD2F1dGgud29ya29zLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMkpDCLE5lWSlUATUjOYDqJStkfr4T3zzWRkmJmEJyeenmeBP9FM7C2Q7MZHRlyT1E4Uf1Z58uawinQM2aVCjf+Q0Gp7D6YfLQ3sakZw4tfyzWLCBhOhZKjex3NyN4b3QeO47sQ1+TEVgBM8aIYMVLFz9UDBQN0V5gRfy1ZPChA2GlC/bjYQD8wJ4Kh1Ybk9YwYqE1/uSetxLBkeu7WL4vWIBtdwLdF9yap9U0rdyOFWjB3c6IlFxv75jCH0bfbC/sbrnx/nHx+LEMZdYdDe75jmMXTEP5YNB5++0a89oMYWU+sFhs57THrNR6qre+NPRfRA4Sg7WNJ2KBdFi9fzJL0CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAFtp51+LIN+OtiC3GUm6HDnAXI5kZYIqiEd2H8dZCaToOclM9Rm2CJoRBqSln+Cafxle+uxxhhCcRlYSfQbGTYfASTWpeYs0tF8ErNIj2JeqLIVM1A/cxn/YMuF3QlS+jWsKrlxY4pMoAJzDsd89iA26pHcrxNyo0+u534epmDcCdJfYb+4frCJxb22Ed8BPsge48v8p8tVZshz0EGw8S42d1xv/CcS22W2JgZ8hcmAbkOt/UCzibEKxoX9k1Ti6fK9LZF6bItWfU56hCbfohHZkn6MtGmQIM3/U8UpBTwGqRbxWDHjmJYrHZdP84xkoVCCR/1R9k9F6/ptXCyfzRIw=="],"x5t#S256":"sAUTaak7Lq3Fzk7iC05UFzpG7NJcOLTjbEiLN02VJs4"}]}
"#;

    #[tokio::test]
    async fn test_generate_jwt() {
        // Parse the test JWKS
        let jwks: jwk::JwkSet = serde_json::from_str(TEST_JWKS).expect("Failed to parse test JWKS");
        let encoding_key = EncodingKey::from_rsa_pem(TEST_PRIVATE_KEY.as_bytes())
            .expect("Failed to create encoding key");
        let claims = Claims::new("test@example.com".into(), 3600, None, None);
        let token =
            generate_jwt(claims.clone(), TEST_KID, &encoding_key).expect("Failed to generate JWT");
        let decoded =
            authorize::<Claims>(&jwks, &token, false, true).expect("Failed to authorize JWT");

        assert_eq!(decoded.claims, claims);
    }

    #[tokio::test]
    async fn test_jwks_from_private_key_pem() {
        use super::jwks_from_private_key_pem;

        // Derive JWKS from the test private key
        let derived_jwks = jwks_from_private_key_pem(TEST_PRIVATE_KEY, "derived_key")
            .expect("Failed to derive JWKS from private key");

        // Verify it has one key with the correct kid
        assert_eq!(derived_jwks.keys.len(), 1);
        assert_eq!(derived_jwks.keys[0].common.key_id, Some("derived_key".to_string()));

        // Generate a JWT using the private key and derived kid
        let encoding_key = EncodingKey::from_rsa_pem(TEST_PRIVATE_KEY.as_bytes())
            .expect("Failed to create encoding key");
        let claims = Claims::new("test@example.com".into(), 3600, None, None);
        let token = generate_jwt(claims.clone(), "derived_key", &encoding_key)
            .expect("Failed to generate JWT");

        // Verify the JWT using the derived JWKS - this proves the keys match!
        let decoded = authorize::<Claims>(&derived_jwks, &token, false, true)
            .expect("Failed to authorize JWT with derived JWKS");

        assert_eq!(decoded.claims, claims);
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

    #[tokio::test]
    async fn test_m2m() {
        let m2m_token = "m2m_token";
        let mut headers = HeaderMap::new();
        headers.insert(
            "authorization",
            format!("Bearer {}", m2m_token).parse().unwrap(),
        );

        let result = authorize_m2m(&headers, m2m_token);
        assert!(result.is_ok());

        let result = authorize_m2m(&headers, "");
        assert!(result.is_err());

        let result = extract_m2m_token(&headers).unwrap();
        assert_eq!(result, String::from(m2m_token));

        let result = extract_m2m_token(&HeaderMap::new());
        assert!(result.is_none());
    }
}
