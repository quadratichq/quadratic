use reqwest::{Response, StatusCode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::SharedError;
use crate::error::Result;
use crate::quadratic_api::Task;

pub const WORKER_GET_WORKER_ACCESS_TOKEN_ROUTE: &str = "/worker/get-worker-access-token";
pub const WORKER_GET_WORKER_INIT_DATA_ROUTE: &str = "/worker/get-worker-init-data";
pub const WORKER_GET_TASKS_ROUTE: &str = "/worker/get-tasks";
pub const WORKER_ACK_TASKS_ROUTE: &str = "/worker/ack-tasks";
pub const WORKER_SHUTDOWN_ROUTE: &str = "/worker/shutdown";
pub const FILE_ID_HEADER: &str = "file-id";
pub const WORKER_EPHEMERAL_TOKEN_HEADER: &str = "worker-ephemeral-token";

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
pub struct GetWorkerAccessTokenResponse {
    pub jwt: String,
}
/// Get a worker access token
pub async fn get_worker_access_token(
    base_url: &str,
    file_id: Uuid,
    worker_ephemeral_token: Uuid,
) -> Result<GetWorkerAccessTokenResponse> {
    let url = format!("{base_url}{WORKER_GET_WORKER_ACCESS_TOKEN_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(
            WORKER_EPHEMERAL_TOKEN_HEADER,
            worker_ephemeral_token.to_string(),
        )
        .send()
        .await?;

    handle_response(&response)?;

    let worker_access_token = response.json::<GetWorkerAccessTokenResponse>().await?;

    Ok(worker_access_token)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetWorkerInitDataResponse {
    pub team_id: Uuid,
    pub sequence_number: u32,
    pub presigned_url: String,
    pub worker_access_token: String,
}
/// Get a worker init data
pub async fn get_worker_init_data(
    base_url: &str,
    file_id: Uuid,
    worker_ephemeral_token: Uuid,
) -> Result<GetWorkerInitDataResponse> {
    let url = format!("{base_url}{WORKER_GET_WORKER_INIT_DATA_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(
            WORKER_EPHEMERAL_TOKEN_HEADER,
            worker_ephemeral_token.to_string(),
        )
        .send()
        .await?;

    handle_response(&response)?;

    let worker_init_data = response.json::<GetWorkerInitDataResponse>().await?;

    Ok(worker_init_data)
}

pub type GetTasksResponse = Vec<(String, Task)>;
/// Get the next scheduled tasks for a worker
pub async fn get_tasks(
    base_url: &str,
    file_id: Uuid,
    worker_ephemeral_token: Uuid,
) -> Result<GetTasksResponse> {
    let url = format!("{base_url}{WORKER_GET_TASKS_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(
            WORKER_EPHEMERAL_TOKEN_HEADER,
            worker_ephemeral_token.to_string(),
        )
        .send()
        .await?;

    handle_response(&response)?;

    let scheduled_tasks_response = response.json::<GetTasksResponse>().await?;
    Ok(scheduled_tasks_response)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AckTasksRequest {
    // (key, task)
    pub successful_tasks: Vec<(String, String)>,
    // (key, task, error)
    pub failed_tasks: Vec<(String, String, String)>,
}

#[derive(Serialize, Deserialize)]
pub struct AckTasksResponse {
    pub success: bool,
}

/// Ack the tasks
pub async fn ack_tasks(
    base_url: &str,
    file_id: Uuid,
    worker_ephemeral_token: Uuid,
    successful_tasks: Vec<(String, String)>,
    failed_tasks: Vec<(String, String, String)>,
) -> Result<AckTasksResponse> {
    let url = format!("{base_url}{WORKER_ACK_TASKS_ROUTE}");

    let request = AckTasksRequest {
        successful_tasks,
        failed_tasks,
    };

    let response = reqwest::Client::new()
        .post(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(
            WORKER_EPHEMERAL_TOKEN_HEADER,
            worker_ephemeral_token.to_string(),
        )
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
    worker_ephemeral_token: Uuid,
) -> Result<ShutdownResponse> {
    let url = format!("{base_url}{WORKER_SHUTDOWN_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .header(
            WORKER_EPHEMERAL_TOKEN_HEADER,
            worker_ephemeral_token.to_string(),
        )
        .send()
        .await?;

    handle_response(&response)?;

    let shutdown_response = response.json::<ShutdownResponse>().await?;
    Ok(shutdown_response)
}
