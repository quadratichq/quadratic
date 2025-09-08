use reqwest::{Response, StatusCode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::SharedError;
use crate::error::Result;
use crate::quadratic_api::Task;

pub const GET_LAST_CHECKPOINT_DATA_URL_ROUTE: &str = "/worker/get-last-checkpoint-data-url";
pub const GET_TASKS_ROUTE: &str = "/worker/get-tasks";
pub const ACK_TASKS_ROUTE: &str = "/worker/ack-tasks";

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

#[derive(Serialize, Deserialize)]
pub struct GetLastCheckpointDataUrlRequest {
    pub file_id: Uuid,
    pub worker_token: Uuid,
}

/// Get a presigned URL for a file
pub async fn get_last_checkpoint_data_url(
    base_url: &str,
    file_id: Uuid,
    worker_token: Uuid,
) -> Result<String> {
    let url = format!("{base_url}{GET_LAST_CHECKPOINT_DATA_URL_ROUTE}");

    let request = GetLastCheckpointDataUrlRequest {
        file_id,
        worker_token,
    };

    let response = reqwest::Client::new()
        .get(url)
        .json(&request)
        .send()
        .await?;

    handle_response(&response)?;

    let last_checkpoint_data_url = response.text().await?;

    Ok(last_checkpoint_data_url)
}

#[derive(Serialize, Deserialize)]
pub struct GetTasksRequest {
    pub file_id: Uuid,
    pub worker_token: Uuid,
}

pub type GetTasksResponse = Vec<Task>;

/// Get the next scheduled tasks for a worker
pub async fn get_tasks(
    base_url: &str,
    file_id: Uuid,
    worker_token: Uuid,
) -> Result<GetTasksResponse> {
    let url = format!("{base_url}{GET_TASKS_ROUTE}");

    let request = GetTasksRequest {
        file_id,
        worker_token,
    };

    let response = reqwest::Client::new()
        .get(url)
        .json(&request)
        .send()
        .await?;

    handle_response(&response)?;

    let scheduled_tasks_response = response.json::<GetTasksResponse>().await?;
    Ok(scheduled_tasks_response)
}

#[derive(Serialize, Deserialize)]
pub struct AckTasksRequest {
    pub file_id: Uuid,
    pub worker_token: Uuid,
    pub task_ids: Vec<Uuid>,
}

#[derive(Serialize, Deserialize)]
pub struct AckTasksResponse {
    pub success: bool,
}

pub async fn ack_tasks(
    base_url: &str,
    file_id: Uuid,
    worker_token: Uuid,
    task_ids: Vec<Uuid>,
) -> Result<AckTasksResponse> {
    let url = format!("{base_url}{ACK_TASKS_ROUTE}");

    let request = AckTasksRequest {
        file_id,
        worker_token,
        task_ids,
    };

    let response = reqwest::Client::new()
        .post(url)
        .json(&request)
        .send()
        .await?;

    handle_response(&response)?;

    let ack_response = response.json::<AckTasksResponse>().await?;
    Ok(ack_response)
}
