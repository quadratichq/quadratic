use anyhow::Result;
use axum::{Extension, http::StatusCode, response::Json};
use quadratic_rust_shared::{
    quadratic_api::get_last_checkpoint_data_url as get_last_checkpoint_data_url_from_api,
    quadratic_cloud::{
        AckTasksRequest, AckTasksResponse, GetLastCheckpointDataUrlRequest, GetTasksRequest,
        GetTasksResponse,
    },
};
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::state::State;

async fn handle_worker_token(
    state: &State,
    file_id: Uuid,
    worker_token: Uuid,
) -> Result<Uuid, StatusCode> {
    match state.verify_worker_token(file_id, worker_token).await {
        Ok(file_id) => Ok(file_id),
        Err(e) => {
            error!("Error verifying worker token: {e}");
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

/// Get a presigned URL for a file
pub(crate) async fn get_last_checkpoint_data_url(
    Extension(state): Extension<Arc<State>>,
    Json(request): Json<GetLastCheckpointDataUrlRequest>,
) -> Result<String, StatusCode> {
    info!(
        "[get_last_checkpoint_data_url] Getting last checkpoint data url for file {}",
        request.file_id
    );

    let file_id = handle_worker_token(&state, request.file_id, request.worker_token).await?;

    let last_checkpoint_data_url = get_last_checkpoint_data_url_from_api(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        file_id,
    )
    .await
    .map_err(|e| {
        info!("Error getting last checkpoint data url: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(last_checkpoint_data_url)
}

/// Get the next tasks for this worker
pub(crate) async fn get_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    Json(request): Json<GetTasksRequest>,
) -> Result<Json<GetTasksResponse>, StatusCode> {
    info!(
        "[get_tasks_for_worker] Getting tasks for worker for file {}",
        request.file_id
    );

    let file_id = handle_worker_token(&state, request.file_id, request.worker_token).await?;

    match state.get_tasks_for_file(file_id).await {
        Ok(tasks) => Ok(Json(tasks)),
        Err(e) => {
            error!("Error getting tasks for file {file_id}, error: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Acknowledge tasks completion
pub(crate) async fn ack_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    Json(ack_request): Json<AckTasksRequest>,
) -> Result<Json<AckTasksResponse>, StatusCode> {
    info!(
        "[ack_tasks_for_worker] Acknowledging tasks for worker for file {}",
        ack_request.file_id
    );

    let file_id =
        handle_worker_token(&state, ack_request.file_id, ack_request.worker_token).await?;

    match state.ack_tasks(file_id, ack_request.task_ids).await {
        Ok(_) => Ok(Json(AckTasksResponse { success: true })),
        Err(e) => {
            error!("Error acknowledging tasks for file {file_id}, error: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// #[derive(Serialize, Deserialize)]
// pub struct HeartbeatRequest {
//     pub current_task: Option<String>,
//     pub status: String,
// }

// #[derive(Serialize, Deserialize)]
// pub struct WorkerStatusResponse {
//     pub should_shutdown: bool,
//     pub pending_tasks: u32,
// }

// /// Worker heartbeat
// async fn worker_heartbeat(
//     Extension(state): Extension<Arc<State>>,
//     ConnectInfo(addr): ConnectInfo<SocketAddr>,
//     Json(heartbeat): Json<HeartbeatRequest>,
// ) -> Result<StatusCode, StatusCode> {
//     let worker_info = extract_worker_info_by_ip(addr.ip(), &state).await?;

//     match state
//         .update_worker_heartbeat(&worker_info.file_id, &worker_info.pod_name, &heartbeat)
//         .await
//     {
//         Ok(_) => {
//             info!(
//                 "Heartbeat from pod {} for file {}",
//                 worker_info.pod_name, worker_info.file_id
//             );
//             Ok(StatusCode::OK)
//         }
//         Err(e) => {
//             warn!("Error updating heartbeat: {}", e);
//             Ok(StatusCode::OK) // Don't fail heartbeats
//         }
//     }
// }

// /// Worker status check
// async fn worker_status(
//     Extension(state): Extension<Arc<State>>,
//     ConnectInfo(addr): ConnectInfo<SocketAddr>,
// ) -> Result<Json<WorkerStatusResponse>, StatusCode> {
//     let worker_info = extract_worker_info_by_ip(addr.ip(), &state).await?;

//     let pending_tasks = state
//         .get_pending_file_tasks_count(&worker_info.file_id)
//         .await
//         .unwrap_or(0) as u32;

//     let should_shutdown = pending_tasks == 0;

//     Ok(Json(WorkerStatusResponse {
//         should_shutdown,
//         pending_tasks,
//     }))
// }
