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
pub(crate) struct FilePerms {
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

/// Retrieve file perms from the quadratic API server.
pub(crate) async fn get_file_perms(
    base_url: &str,
    jwt: String,
    file_id: Uuid,
) -> Result<FilePermRole> {
    let url = format!("{base_url}/v0/files/{file_id}");
    let response = reqwest::Client::new()
        .get(url)
        .header("Authorization", format!("Bearer {}", jwt))
        .send()
        .await?;

    match response.status() {
        StatusCode::OK => Ok(response.json::<FilePerms>().await?.permission),
        StatusCode::FORBIDDEN => Err(MpError::FilePermissions(true, "Forbidden".into())),
        StatusCode::UNAUTHORIZED => Err(MpError::FilePermissions(true, "Unauthorized".into())),
        StatusCode::NOT_FOUND => Err(MpError::FilePermissions(true, "File not found".into())),
        _ => Err(MpError::FilePermissions(true, "Unexpected response".into())),
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
      "contents": "{\"sheets\":[{\"id\":{\"id\":\"168ac41d-3ab8-4f3b-9b0d-a906766590d3\"},\"name\":\"Sheet 1\",\"color\":null,\"order\":\"a0\",\"offsets\":[[],[]],\"columns\":[[0,{\"id\":{\"id\":\"f8500c57-a379-4599-9628-258248847301\"},\"values\":{\"0\":{\"y\":0,\"content\":{\"Values\":[{\"type\":\"text\",\"value\":\"First cell\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[1,{\"id\":{\"id\":\"8dc86264-2952-4c2c-a1fb-d565ca5e67b3\"},\"values\":{\"3\":{\"y\":3,\"content\":{\"Values\":[{\"type\":\"text\",\"value\":\"Over here\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[2,{\"id\":{\"id\":\"1ce4d634-9adb-4a27-898a-856ee85accb8\"},\"values\":{\"7\":{\"y\":7,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"11\"}]}},\"8\":{\"y\":8,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"13\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[3,{\"id\":{\"id\":\"a1fb0564-427b-4e77-92ee-4436da98ad11\"},\"values\":{\"3\":{\"y\":3,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"14\"}]}},\"2\":{\"y\":2,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"15\"}]}},\"5\":{\"y\":5,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"12\"}]}},\"8\":{\"y\":8,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"14\"}]}},\"11\":{\"y\":11,\"content\":{\"Values\":[{\"type\":\"text\",\"value\":\"he\"}]}},\"4\":{\"y\":4,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"13\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[4,{\"id\":{\"id\":\"2b69dd6a-4d68-49ed-a027-286eadb7186f\"},\"values\":{\"3\":{\"y\":3,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"15\"}]}},\"4\":{\"y\":4,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"14\"}]}},\"7\":{\"y\":7,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"16\"}]}},\"2\":{\"y\":2,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"16\"}]}},\"5\":{\"y\":5,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"13\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[5,{\"id\":{\"id\":\"7989e0a1-a7dc-4abc-9a1f-5d68c6a147fd\"},\"values\":{\"7\":{\"y\":7,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"17\"}]}},\"9\":{\"y\":9,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"11\"}]}},\"4\":{\"y\":4,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"15\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[6,{\"id\":{\"id\":\"df9164df-6b6f-4783-9268-2798aa485404\"},\"values\":{\"7\":{\"y\":7,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"18\"}]}},\"4\":{\"y\":4,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"16\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[7,{\"id\":{\"id\":\"ab578fde-130b-4863-a4bb-f5c579213b64\"},\"values\":{\"8\":{\"y\":8,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"300\"}]}},\"3\":{\"y\":3,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"18\"}]}},\"9\":{\"y\":9,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"30\"}]}},\"7\":{\"y\":7,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"20\"}]}},\"4\":{\"y\":4,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"17\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}],[8,{\"id\":{\"id\":\"d2b10a58-d610-49d4-9df9-a54c28fa10ec\"},\"values\":{\"13\":{\"y\":13,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"44\"}]}},\"9\":{\"y\":9,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"40\"}]}},\"11\":{\"y\":11,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"42\"}]}},\"12\":{\"y\":12,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"43\"}]}},\"10\":{\"y\":10,\"content\":{\"Values\":[{\"type\":\"number\",\"value\":\"41\"}]}}},\"spills\":{},\"align\":{},\"wrap\":{},\"numeric_format\":{},\"numeric_decimals\":{},\"numeric_commas\":{},\"bold\":{},\"italic\":{},\"text_color\":{},\"fill_color\":{},\"render_size\":{}}]],\"rows\":[[0,{\"id\":\"cdbd5e9c-232c-4d43-abbe-10de3fce6fa1\"}],[1,{\"id\":\"667b51ec-577d-4a51-aa9d-40fd8d80c0b9\"}],[2,{\"id\":\"7b8728e5-c8da-4157-9913-e881465ace89\"}],[3,{\"id\":\"e3936c53-a818-4adb-8370-09e115c38560\"}],[4,{\"id\":\"bcb2c6a0-aa42-4e8b-ae20-b13a8eb90727\"}],[5,{\"id\":\"8bbb11c7-f1d5-4739-9f92-e9fae47bf12c\"}],[7,{\"id\":\"ccd71c87-3c47-4a28-8c45-71d338c24420\"}],[8,{\"id\":\"0f2d1bae-b46d-4ea3-8ac8-320f64934d3e\"}],[9,{\"id\":\"c4ddefb4-6602-42b4-aa97-be752b204332\"}],[10,{\"id\":\"ece0c649-5fd6-484a-b3e8-82da56fa9cd6\"}],[11,{\"id\":\"d0f4229e-5b6f-48cd-ac30-b8f30b7adb4c\"}],[12,{\"id\":\"e87c144e-2647-41f0-961c-aaf3a137a8fd\"}],[13,{\"id\":\"1ec55964-597f-46ff-af6f-c4749d83971e\"}]],\"borders\":{},\"code_cells\":[]}],\"version\":\"1.4\"}",
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

        println!("perms: {:?}", perms);
        // println!("perms: {}", perms["peramission"]);
    }
}
