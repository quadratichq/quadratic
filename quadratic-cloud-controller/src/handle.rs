use axum::{Extension, http::HeaderMap, response::Json};
use quadratic_rust_shared::quadratic_cloud::{
    AckTasksRequest, AckTasksResponse, FILE_ID_HEADER, GetTasksResponse, ShutdownRequest,
    ShutdownResponse,
};
use std::sync::Arc;
use tracing::info;
use uuid::Uuid;

use crate::controller::Controller;
use crate::error::{ControllerError, Result};
use crate::quadratic_api::{insert_completed_logs, insert_failed_logs};
use crate::state::State;

/// Get tasks for a worker to process
pub(crate) async fn get_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetTasksResponse>> {
    let file_id_str = headers
        .get(FILE_ID_HEADER)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ControllerError::GetTasksForWorker("Missing file-id header".into()))?;

    let file_id = Uuid::parse_str(file_id_str)
        .map_err(|e| ControllerError::GetTasksForWorker(format!("Invalid file_id: {}", e)))?;

    info!("Worker requesting tasks for file {file_id}");

    let tasks = state
        .get_tasks_for_file(file_id)
        .await
        .map_err(|e| ControllerError::GetTasksForWorker(e.to_string()))?;

    info!(
        "Returning {} task(s) to worker for file {file_id}",
        tasks.len()
    );

    Ok(Json(tasks))
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{self, StatusCode},
    };
    use quadratic_rust_shared::{
        quadratic_api::TaskRun,
        quadratic_cloud::{GetTasksResponse, WORKER_GET_TASKS_ROUTE},
    };
    use std::sync::Arc;
    use tower::ServiceExt;
    use uuid::Uuid;

    use crate::{server::worker_only_app, test_util::new_state};

    #[tokio::test]
    async fn test_get_tasks_returns_empty_when_no_tasks() {
        let state = new_state().await;
        let app = worker_only_app(Arc::clone(&state));
        let file_id = Uuid::new_v4();

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(http::Method::GET)
                    .uri(WORKER_GET_TASKS_ROUTE)
                    .header(FILE_ID_HEADER, file_id.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let tasks: GetTasksResponse = serde_json::from_slice(&body).unwrap();

        assert!(tasks.is_empty(), "Should return empty list when no tasks");
    }

    #[tokio::test]
    async fn test_get_tasks_returns_tasks_from_pubsub() {
        let state = new_state().await;

        // Add a task to PubSub for this file
        let file_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();
        let run_id = Uuid::new_v4();

        let task_run = TaskRun {
            file_id,
            task_id,
            run_id,
            operations: vec![1, 2, 3],
        };

        // Add task to pubsub
        state.add_tasks(vec![task_run.clone()]).await.unwrap();

        let app = worker_only_app(Arc::clone(&state));

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(http::Method::GET)
                    .uri(WORKER_GET_TASKS_ROUTE)
                    .header(FILE_ID_HEADER, file_id.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let tasks: GetTasksResponse = serde_json::from_slice(&body).unwrap();

        assert_eq!(tasks.len(), 1, "Should return 1 task");
        let (_, returned_task) = &tasks[0];
        assert_eq!(returned_task.file_id, file_id);
        assert_eq!(returned_task.task_id, task_id);
        assert_eq!(returned_task.operations, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_get_tasks_returns_error_when_missing_file_id_header() {
        let state = new_state().await;
        let app = worker_only_app(Arc::clone(&state));

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(http::Method::GET)
                    .uri(WORKER_GET_TASKS_ROUTE)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should return error status when file-id header is missing
        assert_ne!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_tasks_returns_error_for_invalid_file_id() {
        let state = new_state().await;
        let app = worker_only_app(Arc::clone(&state));

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(http::Method::GET)
                    .uri(WORKER_GET_TASKS_ROUTE)
                    .header(FILE_ID_HEADER, "not-a-valid-uuid")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should return error status for invalid UUID
        assert_ne!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_tasks_returns_multiple_tasks() {
        let state = new_state().await;

        // Add multiple tasks to PubSub for this file
        let file_id = Uuid::new_v4();

        let tasks = vec![
            TaskRun {
                file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![1, 2, 3],
            },
            TaskRun {
                file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![4, 5, 6],
            },
            TaskRun {
                file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![7, 8, 9],
            },
        ];

        // Add tasks to pubsub
        state.add_tasks(tasks.clone()).await.unwrap();

        let app = worker_only_app(Arc::clone(&state));

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(http::Method::GET)
                    .uri(WORKER_GET_TASKS_ROUTE)
                    .header(FILE_ID_HEADER, file_id.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let returned_tasks: GetTasksResponse = serde_json::from_slice(&body).unwrap();

        assert_eq!(returned_tasks.len(), 3, "Should return all 3 tasks");
    }
}
