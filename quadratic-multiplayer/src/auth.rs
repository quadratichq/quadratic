use jsonwebtoken::jwk::AlgorithmParameters;
use jsonwebtoken::{decode, decode_header, jwk, Algorithm, DecodingKey, TokenData, Validation};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use strum_macros::Display;
use uuid::Uuid;

use crate::error::{MpError, Result};

/// Get the JWK set from a given URL.
pub(crate) async fn get_jwks(url: &str) -> Result<jwk::JwkSet> {
    let jwks = reqwest::get(url).await?.json::<jwk::JwkSet>().await?;

    Ok(jwks)
}

// This is only a partial mapping as permission is all that is needed from the
// incoming json struct.
#[derive(Debug, Deserialize)]
pub(crate) struct File {
    lastCheckpointSequenceNumber: u64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct FilePerms {
    file: File,
    permission: FilePermRole,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Display)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum FilePermRole {
    Owner,
    Editor,
    Viewer,
    Annonymous,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub(crate) struct LastCheckpoint {
    pub(crate) sequenceNumber: u64,
    version: String,
    s3Key: String,
    s3Bucket: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Checkpoint {
    fileUuid: Uuid,
    lastCheckpoint: LastCheckpoint,
}

/// Retrieve file perms from the quadratic API server.
pub(crate) async fn get_file_perms(
    base_url: &str,
    jwt: String,
    file_id: Uuid,
) -> Result<(FilePermRole, u64)> {
    let url = format!("{base_url}/v0/files/{file_id}");
    let response = reqwest::Client::new()
        .get(url)
        .header("Authorization", format!("Bearer {}", jwt))
        .send()
        .await?;

    match response.status() {
        StatusCode::OK => {
            let deserailized = response.json::<FilePerms>().await?;
            Ok((
                deserailized.permission,
                deserailized.file.lastCheckpointSequenceNumber,
            ))
        }
        StatusCode::FORBIDDEN => Err(MpError::FilePermissions(true, "Forbidden".into())),
        StatusCode::UNAUTHORIZED => Err(MpError::FilePermissions(true, "Unauthorized".into())),
        StatusCode::NOT_FOUND => Err(MpError::FilePermissions(true, "File not found".into())),
        _ => Err(MpError::FilePermissions(true, "Unexpected response".into())),
    }
}

/// Retrieve file's checkpoint from the quadratic API server.
pub(crate) async fn get_file_checkpoint(
    base_url: &str,
    jwt: String,
    file_id: Uuid,
) -> Result<LastCheckpoint> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/checkpoint");
    let response = reqwest::Client::new()
        .get(url)
        .header("Authorization", format!("Bearer {}", jwt))
        .send()
        .await?;

    match response.status() {
        StatusCode::OK => {
            let deserailized = response.json::<Checkpoint>().await?.lastCheckpoint;
            Ok(deserailized)
        }
        StatusCode::FORBIDDEN => Err(MpError::FilePermissions(true, "Forbidden".into())),
        StatusCode::UNAUTHORIZED => Err(MpError::FilePermissions(true, "Unauthorized".into())),
        StatusCode::NOT_FOUND => Err(MpError::FilePermissions(true, "File not found".into())),
        _ => Err(MpError::FilePermissions(true, "Unexpected response".into())),
    }
}

/// Set the file's checkpoint with the quadratic API server.
pub(crate) async fn set_file_checkpoint(
    base_url: &str,
    jwt: String,
    file_id: &Uuid,
    sequenceNumber: u64,
    version: String,
    s3Key: String,
    s3Bucket: String,
) -> Result<LastCheckpoint> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/checkpoint");
    let body = LastCheckpoint {
        sequenceNumber,
        version,
        s3Key,
        s3Bucket,
    };

    let response = reqwest::Client::new()
        .put(url)
        .header("Authorization", format!("Bearer {}", jwt))
        .json(&body)
        .send()
        .await?;

    match response.status() {
        StatusCode::OK => {
            let deserailized = response.json::<Checkpoint>().await?.lastCheckpoint;
            Ok(deserailized)
        }
        StatusCode::FORBIDDEN => Err(MpError::Unknown("Forbidden".into())),
        StatusCode::UNAUTHORIZED => Err(MpError::Unknown("Unauthorized".into())),
        StatusCode::NOT_FOUND => Err(MpError::Unknown("File not found".into())),
        _ => Err(MpError::Unknown("Unexpected response".into())),
    }
}

/// Authorize a JWT token using a given JWK set.
pub(crate) fn authorize(
    jwks: &jwk::JwkSet,
    token: &str,
    validate_aud: bool,
    validate_exp: bool,
) -> Result<TokenData<HashMap<String, serde_json::Value>>> {
    let header = decode_header(token)?;
    let decoded_token;
    let kid = header
        .kid
        .ok_or_else(|| MpError::Authentication("Token doesn't have a `kid` header field".into()))?;

    // Validate the JWT using an algorithm.  The algorithm needs to be RSA.
    if let Some(jwk) = jwks.find(&kid) {
        match &jwk.algorithm {
            AlgorithmParameters::RSA(rsa) => {
                let decoding_key = DecodingKey::from_rsa_components(&rsa.n, &rsa.e)?;
                let key_algorithm = jwk
                    .common
                    .key_algorithm
                    .ok_or_else(|| MpError::Authentication("Invalid key algorithm".into()))?
                    .to_string();

                let mut validation = Validation::new(Algorithm::from_str(&key_algorithm)?);
                validation.validate_exp = validate_exp;
                validation.validate_aud = validate_aud;

                decoded_token = decode::<HashMap<String, serde_json::Value>>(
                    token,
                    &decoding_key,
                    &validation,
                )?;
            }
            _ => {
                return Err(MpError::Authentication(
                    "Unsupported algorithm, should be RSA".into(),
                ))
            }
        }
    } else {
        return Err(MpError::Authentication(
            "No matching JWK found for the given kid".into(),
        ));
    }

    Ok(decoded_token)
}

/// Validate the role of a user against the required role.
/// TODO(ddimaria): implement this once the new file permissions exist on the api server
pub(crate) fn _validate_role(role: FilePermRole, required_role: FilePermRole) -> Result<()> {
    let authorized = match required_role {
        FilePermRole::Owner => role == FilePermRole::Owner,
        FilePermRole::Editor => role == FilePermRole::Editor || role == FilePermRole::Owner,
        FilePermRole::Viewer => {
            role == FilePermRole::Viewer
                || role == FilePermRole::Editor
                || role == FilePermRole::Owner
        }
        FilePermRole::Annonymous => role == FilePermRole::Annonymous,
    };

    if !authorized {
        MpError::FilePermissions(
            true,
            format!("Invalid role: user has {role} but needs to be {required_role}"),
        );
    }

    Ok(())
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::test_util::TOKEN;

    const JWKS: &str = r#"
{"keys":[{"alg":"RS256","kty":"RSA","use":"sig","n":"2V31IZF-EY2GxXQPI5OaEE--sezizPamNZDW9AjBE2cCErfufM312nT2jUsCnfjsXnh6Z_b-ncOMr97zIZkq1ofU7avemv8nX7NpKmoPBpVrMPprOax2-e3wt-bSfFLIHyghjFLKpkT0LOL_Fimi7xY-J86R06WHojLo3yGzAgQCswZmD4CFf6NcBWDcb6l6kx5vk_AdzHIkVEZH4aikUL_fn3zq5qbE25oOg6pT7F7Pp4zdHOAEKnIRS8tvP8tvvVRkUCrjBxz_Kx6Ne1YOD-fkIMRk_MgIWeKZZzZOYx4VrC0vqYiM-PcKWbNdt1kNoTHOeL06XZeSE6WPZ3VB1Q","e":"AQAB","kid":"1Z57d_i7TE6KTY57pKzDy","x5t":"1gA-aTE9VglLXZnrqvzwWhHsFdk","x5c":["MIIDDTCCAfWgAwIBAgIJHwhLfcIbNvmkMA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNVBAMTGWRldi1kdXp5YXlrNC5ldS5hdXRoMC5jb20wHhcNMjEwNjEzMDcxMTQ1WhcNMzUwMjIwMDcxMTQ1WjAkMSIwIAYDVQQDExlkZXYtZHV6eWF5azQuZXUuYXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2V31IZF+EY2GxXQPI5OaEE++sezizPamNZDW9AjBE2cCErfufM312nT2jUsCnfjsXnh6Z/b+ncOMr97zIZkq1ofU7avemv8nX7NpKmoPBpVrMPprOax2+e3wt+bSfFLIHyghjFLKpkT0LOL/Fimi7xY+J86R06WHojLo3yGzAgQCswZmD4CFf6NcBWDcb6l6kx5vk/AdzHIkVEZH4aikUL/fn3zq5qbE25oOg6pT7F7Pp4zdHOAEKnIRS8tvP8tvvVRkUCrjBxz/Kx6Ne1YOD+fkIMRk/MgIWeKZZzZOYx4VrC0vqYiM+PcKWbNdt1kNoTHOeL06XZeSE6WPZ3VB1QIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRPX3shmtgajnR4ly5t9VYB66ufGDAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQELBQADggEBAHtKpX70WU4uXOMjbFKj0e9HMXyCrdcX6TuYiMFqqlOGWM4yghSM8Bd0HkKcirm4DUoC+1dDMzXMZ+tbntavPt1xG0eRFjeocP+kIYTMQEG2LDM5HQ+Z7bdcwlxnuYOZQfpgKAfYbQ8Cxu38sB6q82I+5NJ0w0VXuG7nUZ1RD+rkXaeMYHNoibAtKBoTWrCaFWGV0E55OM+H0ckcHKUUnNXJOyZ+zEOzPFY5iuYIUmn1LfR1P0SLgIMfiooNC5ZuR/wLdbtyKtor2vzz7niEiewz+aPvfuPnWe/vMtQrfS37/yEhCozFnbIps/+S2Ay78mNBDuOAA9fg5yrnOmjABCU="]},{"alg":"RS256","kty":"RSA","use":"sig","n":"0KDpAuJZyDwPg9CfKi0R3QwDROyH0rvd39lmAoqQNqtYPghDToxFMDLpul0QHttbofHPJMKrPfeEFEOvw7KJgelCHZmckVKaz0e4tfu_2Uvw2kFljCmJGfspUU3mXxLyEea9Ef9JqUru6L8f_0_JIDMT3dceqU5ZqbG8u6-HRgRQ5Jqc_fF29Xyw3gxNP_Q46nsp_0yE68UZE1iPy1om0mpu8mpsY1-Nbvm51C8i4_tFQHdUXbhF4cjAoR0gZFNkzr7FCrL4On0hKeLcvxIHD17SxaBsTuCBGd35g7TmXsA4hSimD9taRHA-SkXh558JG5dr-YV9x80qjeSAvTyjcQ","e":"AQAB","kid":"v2HFn4VqJB-U4vtQRJ3Ql","x5t":"AhUBZjtsFdx7C1PFtWAJ756bo5k","x5c":["MIIDDTCCAfWgAwIBAgIJSSFLkuG8uAM8MA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNVBAMTGWRldi1kdXp5YXlrNC5ldS5hdXRoMC5jb20wHhcNMjEwNjEzMDcxMTQ2WhcNMzUwMjIwMDcxMTQ2WjAkMSIwIAYDVQQDExlkZXYtZHV6eWF5azQuZXUuYXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0KDpAuJZyDwPg9CfKi0R3QwDROyH0rvd39lmAoqQNqtYPghDToxFMDLpul0QHttbofHPJMKrPfeEFEOvw7KJgelCHZmckVKaz0e4tfu/2Uvw2kFljCmJGfspUU3mXxLyEea9Ef9JqUru6L8f/0/JIDMT3dceqU5ZqbG8u6+HRgRQ5Jqc/fF29Xyw3gxNP/Q46nsp/0yE68UZE1iPy1om0mpu8mpsY1+Nbvm51C8i4/tFQHdUXbhF4cjAoR0gZFNkzr7FCrL4On0hKeLcvxIHD17SxaBsTuCBGd35g7TmXsA4hSimD9taRHA+SkXh558JG5dr+YV9x80qjeSAvTyjcQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSEkRwvkyYzzzY/jPd1n7/1VRQNdzAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQELBQADggEBAGtdl7QwzpaWZjbmd6UINAIlpuWIo2v4EJD9kGan/tUZTiUdBaJVwFHOkLRsbZHc5PmBB5IryjOcrqsmKvFdo6wUZA92qTuQVZrOTea07msOKSWE6yRUh1/VCXH2+vAiB9A4DFZ23WpZikBR+DmiD8NGwVgAwWw9jM6pe7ODY+qxFXGjQdTCHcDdbqG2160nKEHCBvjR1Sc/F0pzHPv8CBJCyGAPTCXX42sKZI92pPzdKSmNNijCuIEYLsjzKVxaUuwEqIshk3mYeu6im4VmXXFj+MlyMsusVWi2py7fGFadamzyiV/bxZe+4xzzrRG1Kow/WnVEizfTdEzFXO6YikE="]}]}
"#;
    const PERMS: &str = r#"
{
    "file": {
      "uuid": "f0b89d21-c208-4cad-89ff-bccc21ef087a",
      "name": "Untitled",
      "created_date": "2023-12-11T21:32:55.505Z",
      "updated_date": "2023-12-14T20:57:03.755Z",
      "version": "1.4",
      "lastCheckpointSequenceNumber": 0,
      "thumbnail": "https://quadratic-api-development.s3.us-west-2.amazonaws.com/f0b89d21-c208-4cad-89ff-bccc21ef087a-thumbnail.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA5BUBGQ3MVA3QLOPB%2F20231214%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20231214T233804Z&X-Amz-Expires=604800&X-Amz-Signature=66722966f17648c1e843a3b9d97326909a4b41c204f76d992510efb5aecfb1df&X-Amz-SignedHeaders=host&x-id=GetObject"
    },
    "permission": "OWNER"
  }"#;

    #[tokio::test]
    async fn test_authorize() {
        let jwks: jwk::JwkSet = serde_json::from_str(JWKS).unwrap();
        let result = authorize(&jwks, TOKEN, false, false);
        assert!(result.is_ok());

        // invalid audience causes error
        let result = authorize(&jwks, TOKEN, true, false);
        assert_eq!(
            result.unwrap_err(),
            MpError::Authentication("InvalidAudience".into())
        );

        // past expiration causes error
        let result = authorize(&jwks, TOKEN, false, true);
        assert_eq!(
            result.unwrap_err(),
            MpError::Authentication("ExpiredSignature".into())
        );
    }

    #[tokio::test]
    async fn test_file_perms() {
        let perms = serde_json::from_str::<FilePerms>(PERMS).unwrap();
        assert_eq!(perms.permission, FilePermRole::Owner);
    }
}
