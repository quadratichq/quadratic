use reqwest::{Response, StatusCode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::SharedError;
use crate::error::Result;
use crate::quadratic_api::{GetLastFileCheckpointResponse, Task};

pub const WORKER_GET_LAST_FILE_CHECKPOINT_ROUTE: &str = "/worker/get-last-file-checkpoint";
pub const WORKER_GET_TASKS_ROUTE: &str = "/worker/get-tasks";
pub const WORKER_ACK_TASKS_ROUTE: &str = "/worker/ack-tasks";
pub const WORKER_SHUTDOWN_ROUTE: &str = "/worker/shutdown";
pub const FILE_ID_HEADER: &str = "file-id";
pub const WORKER_TOKEN_HEADER: &str = "worker-token";

fn handle_response(response: &Response) -> Result<()> {
    match response.status() {
        StatusCode::OK => Ok(()),
        StatusCode::FORBIDDEN => Err(SharedError::QuadraticCloudController("Forbidden".into())),
        StatusCode::UNAUTHORIZED => {
            Err(SharedError::QuadraticCloudController("Unauthorized".into()))
        }
        StatusCode::NOT_FOUND => Err(SharedError::QuadraticCloudController("Not found".into())),
        _ => Err(SharedError::QuadraticCloudController(format!(
            "Unexpected response: {response:?}"
        ))),
    }
}

/// Get a last file checkpoint
pub async fn get_last_file_checkpoint(
    base_url: &str,
    file_id: Uuid,
    worker_token: Uuid,
) -> Result<GetLastFileCheckpointResponse> {
    let url = format!("{base_url}{WORKER_GET_LAST_FILE_CHECKPOINT_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(WORKER_TOKEN_HEADER, worker_token.to_string())
        .send()
        .await?;

    handle_response(&response)?;

    let last_file_checkpoint = response.json::<GetLastFileCheckpointResponse>().await?;

    Ok(last_file_checkpoint)
}

pub type GetTasksResponse = Vec<Task>;
/// Get the next scheduled tasks for a worker
pub async fn get_tasks(
    base_url: &str,
    file_id: Uuid,
    worker_token: Uuid,
) -> Result<GetTasksResponse> {
    let url = format!("{base_url}{WORKER_GET_TASKS_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(WORKER_TOKEN_HEADER, worker_token.to_string())
        .send()
        .await?;

    handle_response(&response)?;

    let scheduled_tasks_response = response.json::<GetTasksResponse>().await?;
    Ok(scheduled_tasks_response)
}

#[derive(Serialize, Deserialize)]
pub struct AckTasksRequest {
    pub task_ids: Vec<Uuid>,
}
#[derive(Serialize, Deserialize)]
pub struct AckTasksResponse {
    pub success: bool,
}
/// Ack the tasks
pub async fn ack_tasks(
    base_url: &str,
    file_id: Uuid,
    worker_token: Uuid,
    task_ids: Vec<Uuid>,
) -> Result<AckTasksResponse> {
    let url = format!("{base_url}{WORKER_ACK_TASKS_ROUTE}");

    let request = AckTasksRequest { task_ids };

    let response = reqwest::Client::new()
        .post(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(WORKER_TOKEN_HEADER, worker_token.to_string())
        .json(&request)
        .send()
        .await?;

    handle_response(&response)?;

    let ack_response = response.json::<AckTasksResponse>().await?;
    Ok(ack_response)
}

#[derive(Serialize, Deserialize)]
pub struct ShutdownResponse {
    pub success: bool,
}
/// Shutdown the worker
pub async fn worker_shutdown(
    base_url: &str,
    file_id: Uuid,
    worker_token: Uuid,
) -> Result<ShutdownResponse> {
    let url = format!("{base_url}{WORKER_SHUTDOWN_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(WORKER_TOKEN_HEADER, worker_token.to_string())
        .send()
        .await?;

    handle_response(&response)?;

    let shutdown_response = response.json::<ShutdownResponse>().await?;
    Ok(shutdown_response)
}
