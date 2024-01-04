use reqwest::{Response, StatusCode};
use serde::{Deserialize, Serialize};
use strum_macros::Display;
use uuid::Uuid;

use crate::error::{Result, SharedError};

// This is only a partial mapping as permission is all that is needed from the
// incoming json struct.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct File {
    last_checkpoint_sequence_number: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePerms {
    file: File,
    permission: FilePermRole,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Display)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FilePermRole {
    Owner,
    Editor,
    Viewer,
    Annonymous,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LastCheckpoint {
    pub sequence_number: u64,
    version: String,
    s3_key: String,
    s3_bucket: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    last_checkpoint: LastCheckpoint,
}

/// Retrieve file perms from the quadratic API server.
pub async fn get_file_perms(
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

    handle_response(&response)?;

    let deserailized = response.json::<FilePerms>().await?;
    Ok((
        deserailized.permission,
        deserailized.file.last_checkpoint_sequence_number,
    ))
}

/// Retrieve file's checkpoint from the quadratic API server.
pub async fn get_file_checkpoint(
    base_url: &str,
    jwt: &str,
    file_id: &Uuid,
) -> Result<LastCheckpoint> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/checkpoint");
    let response = reqwest::Client::new()
        .get(url)
        .header("Authorization", format!("Bearer {}", jwt))
        .send()
        .await?;

    handle_response(&response)?;

    let deserailized = response.json::<Checkpoint>().await?.last_checkpoint;
    Ok(deserailized)
}

/// Set the file's checkpoint with the quadratic API server.
pub async fn set_file_checkpoint(
    base_url: &str,
    jwt: &str,
    file_id: &Uuid,
    sequence_number: u64,
    version: String,
    s3_key: String,
    s3_bucket: String,
) -> Result<LastCheckpoint> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/checkpoint");
    let body = LastCheckpoint {
        sequence_number,
        version,
        s3_key,
        s3_bucket,
    };

    let response = reqwest::Client::new()
        .put(url)
        .header("Authorization", format!("Bearer {}", jwt))
        .json(&body)
        .send()
        .await?;

    handle_response(&response)?;

    let deserailized = response.json::<Checkpoint>().await?.last_checkpoint;
    Ok(deserailized)
}

fn handle_response(response: &Response) -> Result<()> {
    match response.status() {
        StatusCode::OK => Ok(()),
        StatusCode::FORBIDDEN => Err(SharedError::QuadraticApi(true, "Forbidden".into())),
        StatusCode::UNAUTHORIZED => Err(SharedError::QuadraticApi(true, "Unauthorized".into())),
        StatusCode::NOT_FOUND => Err(SharedError::QuadraticApi(true, "File not found".into())),
        _ => Err(SharedError::QuadraticApi(
            true,
            "Unexpected response".into(),
        )),
    }
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
        SharedError::QuadraticApi(
            true,
            format!("Invalid role: user has {role} but needs to be {required_role}"),
        );
    }

    Ok(())
}

#[cfg(test)]
pub mod tests {
    use super::*;
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
    async fn file_perms_returns_owner() {
        let perms = serde_json::from_str::<FilePerms>(PERMS).unwrap();
        assert_eq!(perms.permission, FilePermRole::Owner);
    }
}
