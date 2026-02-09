//! Interacting with the Quadratic API

use chrono::{DateTime, NaiveDate, Utc};
use reqwest::{RequestBuilder, Response, StatusCode};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use strum_macros::Display;
use urlencoding::encode;
use uuid::Uuid;

use crate::error::{Result, SharedError};

pub const ADMIN_PERMS: &[FilePermRole] = &[FilePermRole::FileView, FilePermRole::FileEdit];

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
    FileMove,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LastCheckpoint {
    pub sequence_number: u64,
    version: String,
    s3_key: String,
    s3_bucket: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    transactions_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    last_checkpoint: LastCheckpoint,
}

/// Check if the quadratic API server is healthy.
pub async fn is_healthy(base_url: &str) -> bool {
    let url = format!("{base_url}/health");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default()
        .get(&url);
    let response = client.send().await;

    match response {
        Ok(response) => response.status() == StatusCode::OK,
        Err(_) => false,
    }
}

/// Retrieve file perms from the quadratic API server.
pub fn get_client(url: &str, jwt: &str) -> RequestBuilder {
    if jwt.is_empty() {
        reqwest::Client::new().get(url)
    } else {
        reqwest::Client::new()
            .get(url)
            .header("Authorization", format!("Bearer {jwt}"))
    }
}

/// Generic GET request to the quadratic API server.
/// Returns a better error message if the resource is not found.
pub async fn get<T: DeserializeOwned>(url: &str, jwt: &str, error_message: &str) -> Result<T> {
    let client = get_client(url, jwt);
    let response = client.send().await?;

    // return a better error to the user
    if response.status() == StatusCode::NOT_FOUND {
        return Err(SharedError::QuadraticApi(error_message.into()));
    }

    let response = handle_response(response).await?;

    Ok(response.json::<T>().await?)
}

/// Retrieve file perms from the quadratic API server.
pub async fn get_file_perms(
    base_url: &str,
    jwt: String,
    file_id: Uuid,
    m2m_token: Option<&str>,
) -> Result<(Vec<FilePermRole>, u64)> {
    let (permissions, sequence_num) = match m2m_token {
        Some(token) => {
            let checkpoint = get_file_checkpoint(base_url, token, &file_id).await?;
            (ADMIN_PERMS.to_vec(), checkpoint.sequence_number)
        }
        None => get_user_file_perms(base_url, jwt, file_id).await?,
    };

    Ok((permissions, sequence_num))
}

/// Retrieve user file perms from the quadratic API server.
pub async fn get_user_file_perms(
    base_url: &str,
    jwt: String,
    file_id: Uuid,
) -> Result<(Vec<FilePermRole>, u64)> {
    let file_url = format!("{base_url}/v0/files/{file_id}");
    let error_message = format!("File {file_id} not found");
    let deserialized = get::<FilePermsPayload>(&file_url, &jwt, &error_message).await?;

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
    let error_message = format!("File checkpoint for {file_id} not found");
    let checkpoint = get::<Checkpoint>(&url, jwt, &error_message).await?;

    Ok(checkpoint.last_checkpoint)
}

/// Set the file's checkpoint with the quadratic API server.
#[allow(clippy::too_many_arguments)]
pub async fn set_file_checkpoint(
    base_url: &str,
    jwt: &str,
    file_id: &Uuid,
    sequence_number: u64,
    version: String,
    s3_key: String,
    s3_bucket: String,
    transactions_hash: String,
) -> Result<LastCheckpoint> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/checkpoint");
    let body = LastCheckpoint {
        sequence_number,
        version,
        s3_key,
        s3_bucket,
        transactions_hash: Some(transactions_hash),
    };

    let response = reqwest::Client::new()
        .put(url)
        .header("Authorization", format!("Bearer {jwt}"))
        .json(&body)
        .send()
        .await?;

    let response = handle_response(response).await?;

    let deserialized = response.json::<Checkpoint>().await?.last_checkpoint;
    Ok(deserialized)
}

/**************************************************
 * Connections
 **************************************************/

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ConnectionStatus {
    ACTIVE,
    INACTIVE,
    DELETED,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Connection<T> {
    pub uuid: Uuid,
    pub name: String,
    pub r#type: String,
    pub type_details: T,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedConnection<T> {
    pub id: u64,
    pub uuid: Uuid,
    pub connection_id: u64,
    pub percent_completed: u64,
    pub status: ConnectionStatus,
    pub updated_date: DateTime<Utc>,
    pub type_details: T,
    pub r#type: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SyncedConnectionLogStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    FAILED,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedConnectionLogRequest {
    pub run_id: Uuid,
    pub synced_dates: Vec<NaiveDate>,
    pub status: SyncedConnectionLogStatus,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedConnectionLogResponse {
    pub id: u64,
    pub synced_connection_id: u64,
    pub run_id: Uuid,
    pub synced_dates: Vec<NaiveDate>,
    pub status: SyncedConnectionLogStatus,
    pub error: Option<String>,
    pub created_date: DateTime<Utc>,
}

/// Retrieve user's connection from the quadratic API server.
pub async fn get_connection<T: DeserializeOwned>(
    base_url: &str,
    jwt: &str,
    email: &str,
    connection_id: &Uuid,
    team_id: &Uuid,
    is_internal: bool,
) -> Result<Connection<T>> {
    let url = if is_internal {
        format!("{base_url}/v0/internal/connection/{connection_id}")
    } else {
        let encoded_email = encode(email);
        format!(
            "{base_url}/v0/internal/user/{encoded_email}/teams/{team_id}/connections/{connection_id}"
        )
    };
    let error_message = format!("Connection {connection_id} not found");

    get::<Connection<T>>(&url, jwt, &error_message).await
}

/// Retrieve user's connection from the quadratic API server.
pub async fn get_connections_by_type<T: DeserializeOwned>(
    base_url: &str,
    jwt: &str,
    connection_type: &str,
) -> Result<Vec<Connection<T>>> {
    let url = format!("{base_url}/v0/internal/connection?type={connection_type}");
    let error_message = format!("Connection {connection_type} not found");

    get::<Vec<Connection<T>>>(&url, jwt, &error_message).await
}

/// Retrieve all synced connections for a given type from the quadratic API server.
pub async fn get_synced_connections_by_type<T: DeserializeOwned + Serialize>(
    base_url: &str,
    jwt: &str,
    connection_type: &str,
) -> Result<Vec<SyncedConnection<T>>> {
    let url = format!("{base_url}/v0/internal/synced-connection?type={connection_type}");
    let error_message = format!("Synced connection {connection_type} not found");

    get::<Vec<SyncedConnection<T>>>(&url, jwt, &error_message).await
}

/// Create a synced connection log for a synced connection.
pub async fn create_synced_connection_log(
    base_url: &str,
    jwt: &str,
    run_id: Uuid,
    synced_connection_id: u64,
    synced_dates: Vec<NaiveDate>,
    status: SyncedConnectionLogStatus,
    error: Option<String>,
) -> Result<SyncedConnectionLogResponse> {
    tracing::trace!(
        "Creating synced connection log, run_id: {run_id}, synced_connection_id: {synced_connection_id}, status: {status:?}"
    );

    let url = format!("{base_url}/v0/internal/synced-connection/{synced_connection_id}/log");
    let body = SyncedConnectionLogRequest {
        run_id,
        synced_dates,
        status,
        error,
    };

    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Bearer {jwt}"))
        .json(&body)
        .send()
        .await?;

    let response = handle_response(response).await?;
    let synced_connection_log = response.json::<SyncedConnectionLogResponse>().await?;

    Ok(synced_connection_log)
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Team {
    pub ssh_private_key: String,
}

/// Retrieve user's team from the quadratic API server.
pub async fn get_team(base_url: &str, jwt: &str, email: &str, team_id: &Uuid) -> Result<Team> {
    let encoded_email = encode(email);
    let url = format!("{base_url}/v0/internal/user/{encoded_email}/teams/{team_id}");
    let error_message = format!("Team {team_id} not found");

    get::<Team>(&url, jwt, &error_message).await
}

/// Extract the response body from a response.
async fn extract_response_body(response: Response) -> String {
    response
        .text()
        .await
        .unwrap_or_else(|_| "Unable to read response body".to_string())
}

/// Handle a response from the quadratic API server.
async fn handle_response(response: Response) -> Result<Response> {
    let status = response.status();
    match status {
        StatusCode::OK => Ok(response),
        StatusCode::BAD_REQUEST
        | StatusCode::FORBIDDEN
        | StatusCode::UNAUTHORIZED
        | StatusCode::NOT_FOUND => {
            let body = extract_response_body(response).await;
            let error_msg = match status {
                StatusCode::BAD_REQUEST => format!("Bad request: {}", body),
                StatusCode::FORBIDDEN => format!("Forbidden: {}", body),
                StatusCode::UNAUTHORIZED => format!("Unauthorized: {}", body),
                StatusCode::NOT_FOUND => format!("Not found: {}", body),
                _ => unreachable!(),
            };
            Err(SharedError::QuadraticApi(error_msg))
        }
        _ => {
            let body = extract_response_body(response).await;
            Err(SharedError::QuadraticApi(format!(
                "Unexpected response status {}: {}",
                status, body
            )))
        }
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

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GetFileInitDataResponse {
    pub team_id: Uuid,
    pub email: String,
    pub sequence_number: u32,
    pub presigned_url: String,
    pub timezone: Option<String>,
}
pub async fn get_file_init_data(
    base_url: &str,
    jwt: &str,
    file_id: Uuid,
) -> Result<GetFileInitDataResponse> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/init-data");
    let client = get_client(&url, jwt);
    let response = client.send().await?;

    let response = handle_response(response).await?;

    let file_init_data = response
        .json::<GetFileInitDataResponse>()
        .await
        .map_err(|e| SharedError::QuadraticApi(format!("Error getting file init data: {e}")))?;

    Ok(file_init_data)
}

/// Update the file thumbnail key after a worker uploads the thumbnail to S3.
pub async fn update_file_thumbnail(
    base_url: &str,
    jwt: &str,
    file_id: Uuid,
    thumbnail_key: &str,
) -> Result<()> {
    let url = format!("{base_url}/v0/internal/file/{file_id}/thumbnail");

    let response = reqwest::Client::new()
        .put(&url)
        .header("Authorization", format!("Bearer {jwt}"))
        .json(&serde_json::json!({ "thumbnailKey": thumbnail_key }))
        .send()
        .await?;

    handle_response(response).await?;

    Ok(())
}

#[derive(Debug, Serialize, Deserialize, bincode::Encode, bincode::Decode)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    #[bincode(with_serde)]
    pub file_id: Uuid,
    #[bincode(with_serde)]
    pub task_id: Uuid,
    #[bincode(with_serde)]
    pub next_run_time: Option<DateTime<Utc>>,
    pub operations: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, bincode::Encode, bincode::Decode)]
#[serde(rename_all = "camelCase")]
pub struct TaskRun {
    #[bincode(with_serde)]
    pub file_id: Uuid,
    #[bincode(with_serde)]
    pub task_id: Uuid,
    #[bincode(with_serde)]
    pub run_id: Uuid,
    pub operations: Vec<u8>,
}

impl From<Task> for TaskRun {
    fn from(task: Task) -> Self {
        TaskRun {
            file_id: task.file_id,
            task_id: task.task_id,
            run_id: Uuid::new_v4(),
            operations: task.operations,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ScheduledTaskLogStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    FAILED,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskLogRequest {
    pub run_id: Uuid,
    pub status: ScheduledTaskLogStatus,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskLogResponse {
    pub id: u64,
    pub scheduled_task_id: u64,
    pub run_id: Uuid,
    pub status: ScheduledTaskLogStatus,
    pub error: Option<String>,
    pub created_date: DateTime<Utc>,
}

impl TaskRun {
    pub fn as_bytes(&self) -> Result<Vec<u8>> {
        serde_json::to_vec(self).map_err(|e| SharedError::Serialization(e.to_string()))
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        if bytes.is_empty() {
            return Err(SharedError::Serialization("Task data is empty".to_string()));
        }

        // Check if bytes contain only whitespace
        if bytes.iter().all(|&b| b.is_ascii_whitespace()) {
            return Err(SharedError::Serialization(
                "TaskRun data contains only whitespace".to_string(),
            ));
        }

        let task_run = serde_json::from_slice::<Self>(bytes)?;

        Ok(task_run)
    }
}

/// Retrieve all scheduled tasks from the quadratic API server.
pub async fn get_scheduled_tasks(base_url: &str, jwt: &str) -> Result<Vec<Task>> {
    let url = format!("{base_url}/v0/internal/scheduled-tasks");
    let client = get_client(&url, jwt);
    let response = client.send().await?;

    let response = handle_response(response).await?;

    let tasks = response.json::<Vec<Task>>().await?;

    Ok(tasks)
}

/// Create a scheduled task log for a scheduled task.
pub async fn create_scheduled_task_log(
    base_url: &str,
    jwt: &str,
    run_id: Uuid,
    scheduled_task_id: Uuid,
    status: ScheduledTaskLogStatus,
    error: Option<String>,
) -> Result<ScheduledTaskLogResponse> {
    tracing::trace!(
        "Creating scheduled task log, run_id: {run_id}, scheduled_task_id: {scheduled_task_id}, status: {status:?}"
    );

    let url = format!("{base_url}/v0/internal/scheduled-tasks/{scheduled_task_id}/log");
    let body = ScheduledTaskLogRequest {
        run_id,
        status,
        error,
    };

    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Bearer {jwt}"))
        .json(&body)
        .send()
        .await?;

    let response = handle_response(response).await?;

    let scheduled_task_log = response.json::<ScheduledTaskLogResponse>().await?;

    Ok(scheduled_task_log)
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
        assert!(
            perms
                .user_making_request
                .file_permissions
                .contains(&FilePermRole::FileView)
        );
    }
}
