use axum::{Extension, http::HeaderMap, response::Json};
use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::auth::jwt::{Claims, authorize};
use quadratic_rust_shared::quadratic_cloud::{
    AckTasksRequest, AckTasksResponse, FILE_ID_HEADER, GetTasksResponse, ShutdownRequest,
    ShutdownResponse, WORKER_EPHEMERAL_TOKEN_HEADER,
};
use std::sync::Arc;
use tracing::{info, trace, warn};
use uuid::Uuid;

use crate::controller::Controller;
use crate::error::{ControllerError, Result};
use crate::quadratic_api::{insert_completed_logs, insert_failed_logs, update_file_thumbnail};
use crate::state::State;

/// Handle JWKS requests.
///
/// This is called by the worker to get the JWKS for the worker to use to
/// verify the JWT tokens.
pub(crate) async fn jwks(Extension(state): Extension<Arc<State>>) -> Json<JwkSet> {
    Json(state.settings.quadratic_jwks.clone())
}

fn get_file_id_from_headers(headers: &HeaderMap) -> Result<Uuid> {
    headers
        .get(FILE_ID_HEADER)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(ControllerError::FileIdFromHeaders)
}

fn get_ephemeral_token_from_headers(headers: &HeaderMap) -> Result<String> {
    headers
        .get(WORKER_EPHEMERAL_TOKEN_HEADER)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .ok_or(ControllerError::MissingEphemeralToken)
}

/// Validate the ephemeral JWT token and ensure the file_id matches.
/// This is used by endpoints that need authentication but don't rotate the token.
fn validate_worker_token(state: &State, headers: &HeaderMap, expected_file_id: Uuid) -> Result<()> {
    let token = get_ephemeral_token_from_headers(headers)?;

    // Validate signature and expiry
    let token_data = authorize::<Claims>(&state.settings.quadratic_jwks, &token, false, true)
        .map_err(|e| {
            warn!("Invalid worker JWT: {e}");
            ControllerError::InvalidEphemeralToken
        })?;

    // Validate file_id matches
    if token_data.claims.file_id != Some(expected_file_id) {
        warn!(
            "JWT file_id {:?} does not match request file_id {}",
            token_data.claims.file_id, expected_file_id
        );
        return Err(ControllerError::InvalidEphemeralToken);
    }

    Ok(())
}

/// Get token for a worker.
/// The worker must provide its current JWT in the WORKER_EPHEMERAL_TOKEN_HEADER.
/// We validate the JTI from the JWT, consume it (rotate), and issue a new JWT with a new JTI.
pub(crate) async fn get_token_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<String>> {
    let file_id = get_file_id_from_headers(&headers)?;
    let current_jwt = get_ephemeral_token_from_headers(&headers)?;

    // Validate signature AND expiry - expired tokens cannot be rotated even with valid JTI
    let token_data = authorize::<Claims>(&state.settings.quadratic_jwks, &current_jwt, false, true)
        .map_err(|e| {
            // Log details to help diagnose signature issues
            if let Ok(header) = jsonwebtoken::decode_header(&current_jwt) {
                warn!(
                    "Failed to decode worker JWT for file {file_id}: {e}. JWT kid: {:?}, JWKS kids: {:?}",
                    header.kid,
                    state.settings.quadratic_jwks.keys.iter().filter_map(|k| k.common.key_id.as_ref()).collect::<Vec<_>>()
                );
            } else {
                warn!("Failed to decode worker JWT for file {file_id}: {e}");
            }
            ControllerError::InvalidEphemeralToken
        })?;

    // Validate that the JWT's file_id matches the request file_id
    // This prevents a compromised worker from using a JWT issued for a different file
    if token_data.claims.file_id != Some(file_id) {
        warn!(
            "JWT file_id {:?} does not match request file_id {}",
            token_data.claims.file_id, file_id
        );
        return Err(ControllerError::InvalidEphemeralToken);
    }

    // Extract the JTI from the claims
    let jti = token_data.claims.jti.ok_or_else(|| {
        warn!("Worker JWT for file {file_id} missing JTI claim");
        ControllerError::InvalidEphemeralToken
    })?;

    // Validate and rotate the JTI atomically.
    // Note: After this succeeds, the old JTI is invalid. If the worker crashes or loses
    // connectivity before receiving the new JWT, it cannot recover with its current token.
    // This is intentional - workers are ephemeral containers and the controller will
    // recreate the worker with a fresh JTI if needed.
    let new_jti = state
        .worker_jtis
        .validate_and_rotate(file_id, &jti)
        .ok_or_else(|| {
            warn!("Invalid or already-used JTI for file {file_id}");
            ControllerError::InvalidEphemeralToken
        })?;

    // Get cached worker data for generating the new JWT (stored during worker creation)
    let worker_data = state.worker_jtis.get_worker_data(&file_id).ok_or_else(|| {
        warn!("No cached worker data for file {file_id}");
        ControllerError::InvalidEphemeralToken
    })?;

    // Generate new JWT with the new JTI
    let new_jwt = state.settings.generate_worker_jwt_with_jti(
        &worker_data.email,
        file_id,
        worker_data.team_id,
        &new_jti,
    )?;

    trace!("Issued new JWT with rotated JTI for file {file_id}");

    Ok(Json(new_jwt))
}

/// Get tasks for a worker to process.
///
/// This is called by the worker to get the next tasks to process before
/// shutting down.  While minimally useful now, it will become useful
/// once cloud computing is in place and the controller is just on source
/// of tasks for the worker (will be multiplayer in cloud computing).
///
/// Requires a valid ephemeral JWT with matching file_id.
pub(crate) async fn get_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
) -> Result<Json<GetTasksResponse>> {
    let file_id = get_file_id_from_headers(&headers)?;

    // Validate the worker's JWT before returning tasks
    validate_worker_token(&state, &headers, file_id)?;

    trace!("Worker requesting tasks for file {file_id}");

    let tasks = state.get_tasks_for_file(file_id).await?;

    info!(
        "Returning {} task(s) to worker for file {file_id}",
        tasks.len()
    );

    Ok(Json(tasks))
}

/// Acknowledge tasks completion
///
/// Requires a valid ephemeral JWT with matching file_id.
pub(crate) async fn ack_tasks_for_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
    Json(ack_request): Json<AckTasksRequest>,
) -> Result<Json<AckTasksResponse>> {
    let file_id = ack_request.file_id;

    // Validate the worker's JWT before acknowledging tasks
    validate_worker_token(&state, &headers, file_id)?;

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
///
/// Requires a valid ephemeral JWT with matching file_id.
pub(crate) async fn shutdown_worker(
    Extension(state): Extension<Arc<State>>,
    headers: HeaderMap,
    Json(shutdown_request): Json<ShutdownRequest>,
) -> Result<Json<ShutdownResponse>> {
    let container_id = shutdown_request.container_id;
    let file_id = shutdown_request.file_id;

    // Validate the worker's JWT before allowing shutdown
    validate_worker_token(&state, &headers, file_id)?;

    // If the worker uploaded a thumbnail, update the file record via the API
    if let Some(thumbnail_key) = &shutdown_request.thumbnail_key {
        info!("Updating thumbnail for file {file_id} with key {thumbnail_key}");
        if let Err(e) = update_file_thumbnail(&state, file_id, thumbnail_key).await {
            warn!("Failed to update thumbnail for file {file_id}: {e}");
            // Don't fail shutdown if thumbnail update fails
        }
    }

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
        quadratic_cloud::{
            GetTasksResponse, WORKER_EPHEMERAL_TOKEN_HEADER, WORKER_GET_TASKS_ROUTE,
        },
    };
    use std::sync::Arc;
    use tower::ServiceExt;
    use uuid::Uuid;

    use crate::{
        server::{public_app, worker_only_app},
        test_util::new_state,
    };

    /// Generate a valid JWT for testing
    fn generate_test_jwt(state: &State, file_id: Uuid) -> String {
        let team_id = Uuid::new_v4();
        let jti = Uuid::new_v4().to_string();
        state
            .settings
            .generate_worker_jwt_with_jti("test@example.com", file_id, team_id, &jti)
            .expect("Failed to generate test JWT")
    }

    async fn get_tasks_response(
        state: Arc<State>,
        file_id: Option<String>,
    ) -> axum::response::Response {
        let app = worker_only_app(Arc::clone(&state));
        let mut builder = axum::http::Request::builder()
            .method(http::Method::GET)
            .uri(WORKER_GET_TASKS_ROUTE);

        if let Some(ref file_id_str) = file_id {
            builder = builder.header(FILE_ID_HEADER, file_id_str.clone());

            // Generate and include a valid JWT if file_id is a valid UUID
            if let Ok(file_uuid) = Uuid::parse_str(file_id_str) {
                let jwt = generate_test_jwt(&state, file_uuid);
                builder = builder.header(WORKER_EPHEMERAL_TOKEN_HEADER, jwt);
            }
        }

        app.oneshot(builder.body(Body::empty()).unwrap())
            .await
            .unwrap()
    }

    async fn get_tasks_response_body(response: axum::response::Response) -> GetTasksResponse {
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();

        serde_json::from_slice(&body).unwrap()
    }

    #[tokio::test]
    async fn test_jwks() {
        let state = new_state().await;
        let app = public_app(Arc::clone(&state));
        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/.well-known/jwks.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_tasks_returns_empty_when_no_tasks() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let response = get_tasks_response(Arc::clone(&state), Some(file_id.to_string())).await;

        assert_eq!(response.status(), StatusCode::OK);

        let tasks = get_tasks_response_body(response).await;
        assert!(tasks.is_empty(), "Should return empty list when no tasks");
    }

    #[tokio::test]
    async fn test_get_tasks_returns_tasks_from_pubsub() {
        let state = new_state().await;
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

        let response = get_tasks_response(Arc::clone(&state), Some(file_id.to_string())).await;
        assert_eq!(response.status(), StatusCode::OK);

        let tasks = get_tasks_response_body(response).await;
        assert_eq!(tasks.len(), 1, "Should return 1 task");

        let (_, returned_task) = &tasks[0];
        assert_eq!(returned_task.file_id, file_id);
        assert_eq!(returned_task.task_id, task_id);
        assert_eq!(returned_task.operations, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_get_tasks_returns_error_when_missing_file_id_header() {
        let state = new_state().await;
        let response = get_tasks_response(Arc::clone(&state), None).await;

        // Should return error status when file-id header is missing
        assert_ne!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_tasks_returns_error_for_invalid_file_id() {
        let state = new_state().await;
        let response =
            get_tasks_response(Arc::clone(&state), Some("not-a-valid-uuid".to_string())).await;

        // Should return error status for invalid UUID
        assert_ne!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_tasks_returns_multiple_tasks() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let new_task = |operations: Vec<u8>| TaskRun {
            file_id,
            task_id: Uuid::new_v4(),
            run_id: Uuid::new_v4(),
            operations,
        };

        let tasks = vec![
            new_task(vec![1, 2, 3]),
            new_task(vec![4, 5, 6]),
            new_task(vec![7, 8, 9]),
        ];

        // Add tasks to pubsub
        state.add_tasks(tasks.clone()).await.unwrap();

        let response = get_tasks_response(Arc::clone(&state), Some(file_id.to_string())).await;

        assert_eq!(response.status(), StatusCode::OK);

        let returned_tasks = get_tasks_response_body(response).await;
        assert_eq!(returned_tasks.len(), 3, "Should return all 3 tasks");
    }
}
