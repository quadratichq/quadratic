use axum::{Extension, http::HeaderMap, response::Json};
use quadratic_rust_shared::quadratic_cloud::{
    AckTasksRequest, AckTasksResponse, FILE_ID_HEADER, GetTasksResponse, GetWorkerInitDataResponse,
    ShutdownResponse,
};
use std::sync::Arc;
use tracing::{info, trace};
use url::Url;
use uuid::Uuid;

use crate::error::{ControllerError, Result};
use crate::quadratic_api::{insert_completed_logs, insert_failed_logs, insert_running_log};
use crate::state::State;
use crate::{controller::Controller, quadratic_api::file_init_data};

/// Extract the UUID from the header
fn get_uuid_from_header(headers: &HeaderMap) -> Result<Uuid> {
    let header_value = headers
        .get(FILE_ID_HEADER)
        .ok_or_else(|| ControllerError::Header(format!("Missing header: {FILE_ID_HEADER}")))?;

    let id = Uuid::parse_str(
        header_value
            .to_str()
            .map_err(|e| ControllerError::Header(e.to_string()))?,
    )
    .map_err(|e| ControllerError::Header(e.to_string()))?;

    Ok(id)
}

/// Get a file init data
pub(crate) async fn get_file_init_data(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetWorkerInitDataResponse>> {
    let file_id = get_uuid_from_header(&headers)?;

    trace!("Getting file init data for file id {file_id}");

    let mut file_init_data = file_init_data(&state, file_id).await?;

    file_init_data.presigned_url = state
        .settings
        .files_presigned_url(&file_init_data.presigned_url)?
        .to_string();

    trace!("[File init data for file {file_id}: {file_init_data:?}");

    let worker_init_data = GetWorkerInitDataResponse {
        team_id: file_init_data.team_id,
        sequence_number: file_init_data.sequence_number,
        presigned_url: file_init_data.presigned_url,
    };

    Ok(Json(worker_init_data))
}

/// Get the next tasks for this worker
pub(crate) async fn get_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetTasksResponse>> {
    let file_id = get_uuid_from_header(&headers)?;

    info!("Getting tasks for worker for file {file_id}");

    let tasks = state
        .get_tasks_for_file(file_id)
        .await
        .map_err(|e| ControllerError::GetTasksForWorker(e.to_string()))?;

    info!("Got tasks for worker for file {file_id}: {:?}", tasks);

    // Insert a running log for the file
    let task_ids = tasks
        .iter()
        .map(|(_, task)| task.task_id.to_string())
        .collect::<Vec<_>>();
    insert_running_log(&state, task_ids).await?;

    Ok(Json(tasks))
}

/// Acknowledge tasks completion
pub(crate) async fn ack_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
    Json(ack_request): Json<AckTasksRequest>,
) -> Result<Json<AckTasksResponse>> {
    let file_id = get_uuid_from_header(&headers)?;

    info!(
        "Acknowledging tasks for worker for file {file_id}: {:?}",
        ack_request
    );

    // short circuit if there are no keys to ack
    if ack_request.successful_tasks.is_empty() && ack_request.failed_tasks.is_empty() {
        return Ok(Json(AckTasksResponse { success: true }));
    }

    info!(
        "Acknowledging tasks for worker for file {file_id}: {:?}",
        ack_request
    );

    // combine successful and failed keys to ack
    let keys = ack_request
        .successful_tasks
        .iter()
        .map(|(key, _)| key)
        // just grab the first element of the tuple for the key
        .chain(ack_request.failed_tasks.iter().map(|(key, _, _)| key))
        .cloned()
        .collect::<Vec<_>>();

    state
        .ack_tasks(file_id, keys)
        .await
        .map_err(|e| ControllerError::AckTasks(e.to_string()))?;

    // Insert a completed log for the successful keys
    insert_completed_logs(&state, ack_request.successful_tasks).await?;

    // Insert a failed log for the failed keys
    insert_failed_logs(&state, ack_request.failed_tasks).await?;

    Ok(Json(AckTasksResponse { success: true }))
}

/// Shutdown the worker
pub(crate) async fn shutdown_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<ShutdownResponse>> {
    tracing::warn!("handle_worker_shutdown 1");
    let file_id = get_uuid_from_header(&headers)?;
    tracing::warn!("handle_worker_shutdown 2");
    Controller::shutdown_worker(Arc::clone(&state), &file_id)
        .await
        .map_err(|e| ControllerError::ShutdownWorker(e.to_string()))?;
    tracing::warn!("handle_worker_shutdown 2");
    Ok(Json(ShutdownResponse { success: true }))
}
