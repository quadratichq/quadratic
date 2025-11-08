use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use reqwest::{Response, StatusCode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::SharedError;
use crate::error::Result;
use crate::quadratic_api::{Task, TaskRun};

pub const WORKER_GET_WORKER_INIT_DATA_ROUTE: &str = "/worker/get-worker-init-data";
pub const WORKER_GET_TASKS_ROUTE: &str = "/worker/get-tasks";
pub const WORKER_ACK_TASKS_ROUTE: &str = "/worker/ack-tasks";
pub const WORKER_SHUTDOWN_ROUTE: &str = "/worker/shutdown";
pub const FILE_ID_HEADER: &str = "file-id";
pub const WORKER_EPHEMERAL_TOKEN_HEADER: &str = "worker-ephemeral-token";
const MAX_FILE_SIZE: usize = 104857600; // 100 MB
const BINCODE_CONFIG: bincode::config::Configuration<
    bincode::config::LittleEndian,
    bincode::config::Fixint,
    bincode::config::Limit<MAX_FILE_SIZE>, // 100 MB
> = bincode::config::standard()
    .with_fixed_int_encoding()
    .with_limit::<MAX_FILE_SIZE>();

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

#[derive(Debug, Serialize, Deserialize)]
pub struct GetWorkerInitDataResponse {
    pub team_id: Uuid,
    pub sequence_number: u32,
    pub presigned_url: String,
    pub timezone: Option<String>,
}
/// Get a worker init data
pub async fn get_worker_init_data(
    base_url: &str,
    file_id: Uuid,
) -> Result<GetWorkerInitDataResponse> {
    let url = format!("{base_url}{WORKER_GET_WORKER_INIT_DATA_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .send()
        .await?;

    handle_response(&response)?;

    let worker_init_data = response.json::<GetWorkerInitDataResponse>().await?;

    Ok(worker_init_data)
}

pub type GetTasksResponse = Vec<(String, Task)>;
/// Get the next scheduled tasks for a worker
pub async fn get_tasks(base_url: &str, file_id: Uuid) -> Result<GetTasksResponse> {
    let url = format!("{base_url}{WORKER_GET_TASKS_ROUTE}");

    let response = reqwest::Client::new()
        .get(url)
        .header(FILE_ID_HEADER, file_id.to_string())
        .send()
        .await?;

    handle_response(&response)?;

    let scheduled_tasks_response = response.json::<GetTasksResponse>().await?;

    Ok(scheduled_tasks_response)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AckTasksRequest {
    pub container_id: Uuid,
    pub file_id: Uuid,
    // (key, run_id, task_id)
    pub successful_tasks: Vec<(String, Uuid, Uuid)>,
    // (key, run_id, task_id, error)
    pub failed_tasks: Vec<(String, Uuid, Uuid, String)>,
}

#[derive(Serialize, Deserialize)]
pub struct AckTasksResponse {
    pub success: bool,
}

/// Ack the tasks
pub async fn ack_tasks(
    base_url: &str,
    container_id: Uuid,
    file_id: Uuid,
    // (key, run_id, task_id)
    successful_tasks: Vec<(String, Uuid, Uuid)>,
    // (key, run_id, task_id, error)
    failed_tasks: Vec<(String, Uuid, Uuid, String)>,
) -> Result<AckTasksResponse> {
    let url = format!("{base_url}{WORKER_ACK_TASKS_ROUTE}");

    let request = AckTasksRequest {
        container_id,
        file_id,
        successful_tasks,
        failed_tasks,
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

#[derive(Serialize, Deserialize)]
pub struct ShutdownRequest {
    pub container_id: Uuid,
    pub file_id: Uuid,
}

#[derive(Serialize, Deserialize)]
pub struct ShutdownResponse {
    pub success: bool,
}
/// Shutdown the worker
pub async fn worker_shutdown(
    base_url: &str,
    container_id: Uuid,
    file_id: Uuid,
) -> Result<ShutdownResponse> {
    let url = format!("{base_url}{WORKER_SHUTDOWN_ROUTE}");

    let request = ShutdownRequest {
        container_id,
        file_id,
    };

    let response = reqwest::Client::new()
        .post(url)
        .json(&request)
        .send()
        .await?;

    handle_response(&response)?;

    let shutdown_response = response.json::<ShutdownResponse>().await?;
    Ok(shutdown_response)
}

pub fn compress_and_encode_tasks(tasks: Vec<(String, TaskRun)>) -> Result<String> {
    let binary_tasks = compress_tasks(tasks)?;
    let encoded_tasks = encode_tasks(binary_tasks)?;
    Ok(encoded_tasks)
}

pub fn decompress_and_decode_tasks(encoded_tasks: String) -> Result<Vec<(String, TaskRun)>> {
    let binary_tasks = decode_tasks(encoded_tasks)?;
    let tasks = decompress_tasks(binary_tasks)?;
    Ok(tasks)
}

pub fn compress_tasks(tasks: Vec<(String, TaskRun)>) -> Result<Vec<u8>> {
    let binary_tasks = bincode::encode_to_vec(&tasks, bincode::config::standard())
        .map_err(|e| SharedError::Serialization(format!("Failed to serialize tasks: {}", e)))?;

    Ok(binary_tasks)
}

pub fn decompress_tasks(binary_tasks: Vec<u8>) -> Result<Vec<(String, TaskRun)>> {
    let (tasks, _) = bincode::decode_from_slice(&binary_tasks, bincode::config::standard())
        .map_err(|e| SharedError::Serialization(format!("Failed to deserialize tasks: {}", e)))?;

    Ok(tasks)
}

pub fn encode_tasks(binary_tasks: Vec<u8>) -> Result<String> {
    let encoded_tasks = BASE64.encode(binary_tasks);
    Ok(encoded_tasks)
}

pub fn decode_tasks(encoded_tasks: String) -> Result<Vec<u8>> {
    let binary_tasks = BASE64
        .decode(encoded_tasks)
        .map_err(|e| SharedError::Serialization(format!("Failed to decode tasks: {}", e)))?;
    Ok(binary_tasks)
}

pub fn serialize_tasks(tasks: Vec<Task>) -> Result<Vec<u8>> {
    let binary_tasks = bincode::encode_to_vec(&tasks, BINCODE_CONFIG)
        .map_err(|e| SharedError::Serialization(format!("Failed to serialize tasks: {}", e)))?;

    Ok(binary_tasks)
}

pub fn deserialize_tasks(binary_tasks: Vec<u8>) -> Result<Vec<Task>> {
    let (tasks, _) = bincode::decode_from_slice(&binary_tasks, BINCODE_CONFIG)
        .map_err(|e| SharedError::Serialization(format!("Failed to deserialize tasks: {}", e)))?;

    Ok(tasks)
}
