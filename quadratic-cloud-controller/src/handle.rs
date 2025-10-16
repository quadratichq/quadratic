use axum::{Extension, response::Json};
use quadratic_rust_shared::quadratic_cloud::{
    AckTasksRequest, AckTasksResponse, ShutdownRequest, ShutdownResponse,
};
use std::sync::Arc;
use tracing::info;

use crate::controller::Controller;
use crate::error::{ControllerError, Result};
use crate::quadratic_api::{insert_completed_logs, insert_failed_logs};
use crate::state::State;

/// Acknowledge tasks completion
pub(crate) async fn ack_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    Json(ack_request): Json<AckTasksRequest>,
) -> Result<Json<AckTasksResponse>> {
    let file_id = ack_request.file_id;

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
        .map(|(key, _, _)| key)
        .chain(ack_request.failed_tasks.iter().map(|(key, _, _, _)| key))
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
    Json(shutdown_request): Json<ShutdownRequest>,
) -> Result<Json<ShutdownResponse>> {
    let container_id = shutdown_request.container_id;
    let file_id = shutdown_request.file_id;

    Controller::shutdown_worker(Arc::clone(&state), &container_id, &file_id)
        .await
        .map_err(|e| ControllerError::ShutdownWorker(e.to_string()))?;

    Ok(Json(ShutdownResponse { success: true }))
}
