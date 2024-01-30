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
pub struct FilePermsPayload {
    file: File,
    user_making_request: FilePerms,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePerms {
    file_permissions: Vec<FilePermRole>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Display)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FilePermRole {
    FileView,
    FileEdit,
    FileDelete,
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
) -> Result<(Vec<FilePermRole>, u64)> {
    let url = format!("{base_url}/v0/files/{file_id}");
    let response = if jwt.is_empty() {
        reqwest::Client::new().get(url).send()
    } else {
        reqwest::Client::new()
            .get(url)
            .header("Authorization", format!("Bearer {}", jwt))
            .send()
    }
    .await?;

    handle_response(&response)?;

    let deserialized = response.json::<FilePermsPayload>().await?;

    Ok((
        deserialized.user_making_request.file_permissions,
        deserialized.file.last_checkpoint_sequence_number,
    ))
}

/// Retrieve file's checkpoint from the quadratic API server.
pub async fn get_file_checkpoint(
    base_url: &str,
    jwt: &str,
    file_id: &Uuid,
) -> Result<LastCheckpoint> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/checkpoint");
    let response = if jwt.is_empty() {
        reqwest::Client::new().get(url).send()
    } else {
        reqwest::Client::new()
            .get(url)
            .header("Authorization", format!("Bearer {}", jwt))
            .send()
    }
    .await?;
    handle_response(&response)?;

    Ok(response.json::<Checkpoint>().await?.last_checkpoint)
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

    let deserialized = response.json::<Checkpoint>().await?.last_checkpoint;
    Ok(deserialized)
}

fn handle_response(response: &Response) -> Result<()> {
    match response.status() {
        StatusCode::OK => Ok(()),
        StatusCode::FORBIDDEN => Err(SharedError::QuadraticApi("Forbidden".into())),
        StatusCode::UNAUTHORIZED => Err(SharedError::QuadraticApi("Unauthorized".into())),
        StatusCode::NOT_FOUND => Err(SharedError::QuadraticApi("File not found".into())),
        _ => Err(SharedError::QuadraticApi("Unexpected response".into())),
    }
}

/// Validate that role allows viewing a file
pub fn can_view(role: &[FilePermRole]) -> bool {
    role.contains(&FilePermRole::FileView)
}

/// Validate that role allows editing a file
pub fn can_edit(role: &[FilePermRole]) -> bool {
    role.contains(&FilePermRole::FileEdit)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    const PERMS: &str = r#"
{
    "file": {
        "uuid": "0e53acb6-3045-4def-8611-bdf35493a425",
        "name": "Untitled",
        "createdDate": "2024-01-11T22:41:41.556Z",
        "updatedDate": "2024-01-11T22:41:41.556Z",
        "publicLinkAccess": "NOT_SHARED",
        "lastCheckpointSequenceNumber": 0,
        "lastCheckpointVersion": "1.4",
        "lastCheckpointDataUrl": "https://quadratic-api-development.s3.us-west-2.amazonaws.com/0e53acb6-3045-4def-8611-bdf35493a425-0.grid?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA5BUBGQ3MVA3QLOPB%2F20240111%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240111T225400Z&X-Amz-Expires=120&X-Amz-Signature=7940db9ee303bd81faf7ca468219075822bbd66b669ad150a69be943841af105&X-Amz-SignedHeaders=host&x-id=GetObject",
        "thumbnail": "https://quadratic-api-development.s3.us-west-2.amazonaws.com/0e53acb6-3045-4def-8611-bdf35493a425-thumbnail.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA5BUBGQ3MVA3QLOPB%2F20240111%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240111T225400Z&X-Amz-Expires=120&X-Amz-Signature=42545f5fef210677be1aa8e51ef127f6d5a82804dc792c345bae15df9a60951b&X-Amz-SignedHeaders=host&x-id=GetObject"
    },
    "owner": { "type": "self" },
    "userMakingRequest": {
        "filePermissions": ["FILE_VIEW", "FILE_EDIT", "FILE_DELETE"]
    }
}"#;

    #[tokio::test]
    async fn test_file_perms_parse() {
        let perms = serde_json::from_str::<FilePermsPayload>(PERMS).unwrap();
        assert!(perms
            .user_making_request
            .file_permissions
            .contains(&FilePermRole::FileView));
    }
}
