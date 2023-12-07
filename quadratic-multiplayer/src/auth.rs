use anyhow::{anyhow, bail, Result};

use jsonwebtoken::jwk::AlgorithmParameters;
use jsonwebtoken::{decode, decode_header, jwk, Algorithm, DecodingKey, Validation};
use std::collections::HashMap;
use std::str::FromStr;

// TODO(ddimaria): get this from the autho0 jwks api
const JWKS_REPLY: &str = r#"
{"keys":[{"kty":"RSA","use":"sig","n":"x9i16nnQlc6oslwtEWfzzA_XKVLnE9upv2hjOEFEzAPeTcdvPZsiFRNyEI8vEq82rPWW4csxDf_zIVhuIikO7aRmfIsYzj7N2lJS-llb6UfXZ9Fqd2FNguUMUbGnUjFMfJLTBMy1nb770URJJ3qKDadyEUAPuLp5g0bOLDTBcb1R70RoKDjN_FJNvw362M5ZlceARk_NNrZPU-gjnZ0yAk1Cqy8ReiWXj26qU9qCcPToOd3ZqmRBOaUijiw3UPfcvpCtv7x8cEzVpe0FMWjVoMF88IulOnN-_-JJyl950ZS-4faScOCLC7l6jPVBIXaqjv5N34D4Xe9uM6NCzOXH9Q","e":"AQAB","kid":"1x4nzYEuDt42GOaimELXG","x5t":"iDqzuDHVsJVQxdGtY_c4Vd2Q1sI","x5c":["MIIDDTCCAfWgAwIBAgIJfWV6WgTrT/s4MA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNVBAMTGWRldi1uamU3ZHc4cy51cy5hdXRoMC5jb20wHhcNMjIwNjIzMTczNjAyWhcNMzYwMzAxMTczNjAyWjAkMSIwIAYDVQQDExlkZXYtbmplN2R3OHMudXMuYXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx9i16nnQlc6oslwtEWfzzA/XKVLnE9upv2hjOEFEzAPeTcdvPZsiFRNyEI8vEq82rPWW4csxDf/zIVhuIikO7aRmfIsYzj7N2lJS+llb6UfXZ9Fqd2FNguUMUbGnUjFMfJLTBMy1nb770URJJ3qKDadyEUAPuLp5g0bOLDTBcb1R70RoKDjN/FJNvw362M5ZlceARk/NNrZPU+gjnZ0yAk1Cqy8ReiWXj26qU9qCcPToOd3ZqmRBOaUijiw3UPfcvpCtv7x8cEzVpe0FMWjVoMF88IulOnN+/+JJyl950ZS+4faScOCLC7l6jPVBIXaqjv5N34D4Xe9uM6NCzOXH9QIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBR7BGUkLd+2X3Ame9SAiDPIA47YfTAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQELBQADggEBADVW1Y+pDXOl9ogJnJlpSpt6ntMHrhzSJTMJbHqkX7X9i3PVyVuK43cQfSmUKPpOVejbdYKJ6EkxRMYh9ZHUDCsz+fwM+6VvFZ8Xkb1jtHIDTkJKhQnlGk126G7fOq/ScB4Fa+fdu2aYKebpNN/12VY8r7FiEshcsIWTcRE2w/Dij9gHIBa/+DCsjo0h+vYC05cf0EBIPzQriNAFh8XgEUAbp7Lk+Hth0OHElm/3C7Ch22IBqdgLVyuvWm3J/iUbHvQ9rxL1myZnyEAVbckHuB5GHCjZa7H4CeKRGnlv/cuSE/bRbV214r3x60Hvpxo51yDLs0E5HK509D5038UD+6Y="],"alg":"RS256"},{"kty":"RSA","use":"sig","n":"qOzrg1UULl9hGpSTGSo4GMIDCBPYLIr6A2qe9SW2TNPdYUONkrA5hKS5v5_20Tu-92LVx2OnRXWjsKVgpV-0rxsVgdyOBclvK0YetY8u9xIF3SvbiUcedrUo-dZj5CVpOKIhCzsFkDuvLhU1bI2vgc_S8j7wtLUb0qboPk39cUl1iJyLQvzb8tNwbMBdKUhsMKaHVrUC0fv2lwrgLJ5UryDD4QPrBt1Ok3YwumeaWU8wfEhe2QqbvecPxvMV2ydwEBElGy4qtAOmdqf9dlaFvgMvKg38hYAfYW7bqzTX6jqgO2YQxQWVYYU6utX52QJkHRfm4iWye-ANFJIU7ZZHOw","e":"AQAB","kid":"VVwQjxFvQBBth8FgRs5sy","x5t":"BivR3N-O6YbltNcnzzbOm_F5b0E","x5c":["MIIDDTCCAfWgAwIBAgIJcK74KIw5CxDiMA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNVBAMTGWRldi1uamU3ZHc4cy51cy5hdXRoMC5jb20wHhcNMjIwNjIzMTczNjAzWhcNMzYwMzAxMTczNjAzWjAkMSIwIAYDVQQDExlkZXYtbmplN2R3OHMudXMuYXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqOzrg1UULl9hGpSTGSo4GMIDCBPYLIr6A2qe9SW2TNPdYUONkrA5hKS5v5/20Tu+92LVx2OnRXWjsKVgpV+0rxsVgdyOBclvK0YetY8u9xIF3SvbiUcedrUo+dZj5CVpOKIhCzsFkDuvLhU1bI2vgc/S8j7wtLUb0qboPk39cUl1iJyLQvzb8tNwbMBdKUhsMKaHVrUC0fv2lwrgLJ5UryDD4QPrBt1Ok3YwumeaWU8wfEhe2QqbvecPxvMV2ydwEBElGy4qtAOmdqf9dlaFvgMvKg38hYAfYW7bqzTX6jqgO2YQxQWVYYU6utX52QJkHRfm4iWye+ANFJIU7ZZHOwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBTUKSqOLEU4Kfcomksub/s3zhIT8zAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQELBQADggEBADVwQ9ppELkSTzoA4wFf/V1+JFvOixoYJSDuSlVm7owKdE9rQAR/NQtTVwlPGphoP+69xjvB2i7GS+NQ/BDnWSYIYcP/ZtMVI9sl6DTMgu1d2aWilY7XZy4XXNe0ywwSdFgctfagj8DUH+C+yVEfdtG3Lv8ovfRR5DESB0CFCEe38TvZ6dM8A7+CsP2rmFvJ/gl4JjtUUYvjEGqb/mcExPHgEHzT2fRLBwPEZ/q6In9ZJrMr0Cnzr0B11BN2alHs8YdmStzPRs9J6MG9WmG/Kok5rSkiQxsmEdKnFTfLU+St45WQ+XAqeWOAtad6IKlcmL4DtT5VLFlTRPRVrBEGCvA="],"alg":"RS256"}]}
"#;

pub(crate) async fn get_jwks(url: &str) -> Result<jwk::JwkSet> {
    let jwks = reqwest::get(url).await?.json::<jwk::JwkSet>().await?;

    Ok(jwks)
}

pub(crate) fn authorize(jwks: jwk::JwkSet, token: &str) -> Result<()> {
    let header = decode_header(token)?;
    let kid = header
        .kid
        .ok_or_else(|| anyhow!("Token doesn't have a `kid` header field"))?;

    if let Some(jwk) = jwks.find(&kid) {
        match &jwk.algorithm {
            AlgorithmParameters::RSA(rsa) => {
                let decoding_key = DecodingKey::from_rsa_components(&rsa.n, &rsa.e)?;
                let key_algorithm = jwk
                    .common
                    .key_algorithm
                    .ok_or_else(|| anyhow!("Invalid key algorithm"))?
                    .to_string();
                let mut validation = Validation::new(Algorithm::from_str(&key_algorithm)?);

                // TODO(ddimaria): remove this once this domain is added to the audience
                validation.validate_aud = false;

                let _decoded_token = decode::<HashMap<String, serde_json::Value>>(
                    token,
                    &decoding_key,
                    &validation,
                )?;
            }
            _ => bail!("Unsupported algorithm, should be RSA"),
        }
    } else {
        bail!("No matching JWK found for the given kid");
    }

    Ok(())
}
