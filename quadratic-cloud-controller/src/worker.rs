use anyhow::Result;
use axum::{
    Extension,
    http::{HeaderMap, StatusCode},
    response::Json,
};
use quadratic_rust_shared::{
    quadratic_api::get_file_init_data,
    quadratic_cloud::{
        AckTasksRequest, AckTasksResponse, FILE_ID_HEADER, GetTasksResponse,
        GetWorkerAccessTokenResponse, GetWorkerInitDataResponse, ShutdownResponse,
        WORKER_EPHEMERAL_TOKEN_HEADER,
    },
};
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::{controller::Controller, state::State};

/// Extract the UUID from the header
fn get_uuid_from_header(headers: &HeaderMap, header_name: &str) -> Result<Uuid, StatusCode> {
    let header_value = match headers.get(header_name) {
        Some(header_value) => header_value,
        None => {
            error!("Missing header: {header_name}");
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let header_string_value = match header_value.to_str() {
        Ok(header_string_value) => header_string_value,
        Err(e) => {
            error!("Error converting header value to string: {header_name}, error: {e}");
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    match Uuid::parse_str(header_string_value) {
        Ok(header_value) => Ok(header_value),
        Err(e) => {
            error!(
                "Error parsing UUID from header: {header_name}: {header_string_value}, error: {e}"
            );
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

/// Extract the file id and worker ephemeral token from the headers and verify the worker ephemeral token
///
/// Returns the file id if the worker ephemeral token is valid
async fn handle_worker_ephemeral_token(
    state: &State,
    headers: &HeaderMap,
) -> Result<Uuid, StatusCode> {
    let file_id = get_uuid_from_header(headers, FILE_ID_HEADER)?;

    let worker_ephemeral_token = match get_uuid_from_header(headers, WORKER_EPHEMERAL_TOKEN_HEADER)
    {
        Ok(worker_ephemeral_token) => worker_ephemeral_token,
        Err(e) => {
            error!("Error getting worker ephemeral token: {e}");
            state.remove_worker_ephemeral_token(&file_id).await;
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    match state
        .verify_worker_ephemeral_token(file_id, worker_ephemeral_token)
        .await
    {
        Ok(file_id) => Ok(file_id),
        Err(e) => {
            error!("Error verifying worker ephemeral token: {e}");
            state.remove_worker_ephemeral_token(&file_id).await;
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

/// Get a worker access token
pub(crate) async fn handle_get_worker_access_token(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetWorkerAccessTokenResponse>, StatusCode> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    info!("[handle_get_worker_access_token] Getting worker access token for file {file_id}",);

    match state.generate_worker_access_token(file_id).await {
        Ok(jwt) => Ok(Json(GetWorkerAccessTokenResponse { jwt })),
        Err(e) => {
            error!("Error getting worker access token: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get a file init data
pub(crate) async fn handle_get_file_init_data(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetWorkerInitDataResponse>, StatusCode> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    info!("[handle_get_file_init_data] Getting file init data for file id {file_id}",);

    match get_file_init_data(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        file_id,
    )
    .await
    {
        Ok(file_init_data) => {
            let worker_access_token = match state.generate_worker_access_token(file_id).await {
                Ok(worker_access_token) => worker_access_token,
                Err(e) => {
                    error!("Error generating worker access token for file {file_id}, error: {e}");
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            };

            let worker_init_data = GetWorkerInitDataResponse {
                team_id: file_init_data.team_id,
                sequence_number: file_init_data.sequence_number,
                presigned_url: file_init_data.presigned_url,
                worker_access_token,
            };

            Ok(Json(worker_init_data))
        }
        Err(e) => {
            error!("Error getting file init data for file {file_id}, error: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get the next tasks for this worker
pub(crate) async fn handle_get_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetTasksResponse>, StatusCode> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    info!("[handle_get_tasks_for_worker] Getting tasks for worker for file {file_id}",);

    match state.get_tasks_for_file(file_id).await {
        Ok(tasks) => Ok(Json(tasks)),
        Err(e) => {
            error!("Error getting tasks for file {file_id}, error: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Acknowledge tasks completion
pub(crate) async fn handle_ack_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
    Json(ack_request): Json<AckTasksRequest>,
) -> Result<Json<AckTasksResponse>, StatusCode> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    info!("[handle_ack_tasks_for_worker] Acknowledging tasks for worker for file {file_id}",);

    match state.ack_tasks(file_id, ack_request.task_ids).await {
        Ok(_) => Ok(Json(AckTasksResponse { success: true })),
        Err(e) => {
            error!("Error acknowledging tasks for file {file_id}, error: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Shutdown the worker
pub(crate) async fn handle_worker_shutdown(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<ShutdownResponse>, StatusCode> {
    let file_id = handle_worker_ephemeral_token(&state, &headers).await?;

    info!("[handle_worker_shutdown] Shutting down worker for file {file_id}",);

    state.remove_worker_ephemeral_token(&file_id).await;

    match Controller::shutdown_worker(&state, &file_id).await {
        Ok(_) => Ok(Json(ShutdownResponse { success: true })),
        Err(e) => {
            error!("Error shutting down worker for file {file_id}, error: {e}");
            Ok(Json(ShutdownResponse { success: false }))
        }
    }
}
