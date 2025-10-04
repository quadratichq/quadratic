use axum::{Extension, http::HeaderMap, response::Json};
use quadratic_rust_shared::{
    quadratic_api::get_file_init_data,
    quadratic_cloud::{
        AckTasksRequest, AckTasksResponse, FILE_ID_HEADER, GetTasksResponse,
        GetWorkerAccessTokenResponse, GetWorkerInitDataResponse, ShutdownResponse,
        WORKER_EPHEMERAL_TOKEN_HEADER,
    },
};
use std::sync::Arc;
use tracing::{info, trace};
use uuid::Uuid;

use crate::controller::Controller;
use crate::error::{ControllerError, Result};
use crate::state::State;

/// Extract the UUID from the header
fn get_uuid_from_header(headers: &HeaderMap, header_name: &str) -> Result<Uuid> {
    let header_value = headers
        .get(header_name)
        .ok_or_else(|| ControllerError::Header(format!("Missing header: {header_name}")))?;
    let id = Uuid::parse_str(
        header_value
            .to_str()
            .map_err(|e| ControllerError::Header(e.to_string()))?,
    )
    .map_err(|e| ControllerError::Header(e.to_string()))?;

    Ok(id)
}

/// Extract the file id and worker ephemeral token from the headers and verify the worker ephemeral token
///
/// Returns the file id if the worker ephemeral token is valid
async fn handle_worker_ephemeral_token(state: &State, headers: &HeaderMap) -> Result<Uuid> {
    let file_id = get_uuid_from_header(headers, FILE_ID_HEADER)?;

    let worker_ephemeral_token = match get_uuid_from_header(headers, WORKER_EPHEMERAL_TOKEN_HEADER)
    {
        Ok(worker_ephemeral_token) => worker_ephemeral_token,
        Err(e) => {
            state.remove_worker_ephemeral_token(&file_id).await;
            return Err(ControllerError::WorkerEphemeralToken(e.to_string()));
        }
    };

    state
        .verify_worker_ephemeral_token(file_id, worker_ephemeral_token)
        .await
        .map_err(|e| ControllerError::WorkerEphemeralToken(e.to_string()))?;

    Ok(file_id)
}

/// Get a worker access token
pub(crate) async fn handle_get_worker_access_token(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetWorkerAccessTokenResponse>> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    trace!("Getting worker access token for file {file_id}");

    let token = state
        .generate_worker_access_token(file_id)
        .await
        .map_err(|e| ControllerError::WorkerAccessToken(e.to_string()))?;

    Ok(Json(GetWorkerAccessTokenResponse { jwt: token }))
}

/// Get a file init data
pub(crate) async fn handle_get_file_init_data(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetWorkerInitDataResponse>> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    trace!("Getting file init data for file id {file_id}");

    let mut file_init_data = get_file_init_data(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        file_id,
    )
    .await
    .map_err(|e| ControllerError::GetFileInitData(e.to_string()))?;

    // TODO(ddimaria): Remove this
    file_init_data.presigned_url = file_init_data
        .presigned_url
        .replace("0.0.0.0", "host.docker.internal");

    trace!("[File init data for file {file_id}: {file_init_data:?}");

    let worker_access_token = state
        .generate_worker_access_token(file_id)
        .await
        .map_err(|e| ControllerError::WorkerAccessToken(e.to_string()))?;

    let worker_init_data = GetWorkerInitDataResponse {
        team_id: file_init_data.team_id,
        sequence_number: file_init_data.sequence_number,
        presigned_url: file_init_data.presigned_url,
        worker_access_token,
    };

    Ok(Json(worker_init_data))
}

/// Get the next tasks for this worker
pub(crate) async fn handle_get_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetTasksResponse>> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    trace!("Getting tasks for worker for file {file_id}");

    let tasks = state
        .get_tasks_for_file(file_id)
        .await
        .map_err(|e| ControllerError::GetTasksForWorker(e.to_string()))?;

    Ok(Json(tasks))
}

/// Acknowledge tasks completion
pub(crate) async fn handle_ack_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
    Json(ack_request): Json<AckTasksRequest>,
) -> Result<Json<AckTasksResponse>> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    info!("Acknowledging tasks for worker for file {file_id}");

    state
        .ack_tasks(file_id, ack_request.task_ids)
        .await
        .map_err(|e| ControllerError::AckTasks(e.to_string()))?;

    Ok(Json(AckTasksResponse { success: true }))
}

/// Shutdown the worker
pub(crate) async fn handle_worker_shutdown(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<ShutdownResponse>> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    info!("Shutting down worker for file {file_id}",);

    state.remove_worker_ephemeral_token(&file_id).await;

    Controller::shutdown_worker(&state, &file_id)
        .await
        .map_err(|e| ControllerError::ShutdownWorker(e.to_string()))?;

    Ok(Json(ShutdownResponse { success: true }))
}
