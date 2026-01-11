use quadratic_rust_shared::quadratic_api::{
    GetFileInitDataResponse, ScheduledTaskLogResponse, ScheduledTaskLogStatus, TaskRun,
    create_scheduled_task_log, get_file_init_data, get_scheduled_tasks,
};
use tracing::trace;
use uuid::Uuid;

use crate::{
    error::{ControllerError, Result},
    state::State,
};

fn api_error(error: impl ToString, kind: &str) -> ControllerError {
    ControllerError::QuadraticApi(kind.to_string(), error.to_string())
}

/// Get the file init data for a file.
///
/// Init data includes the team id, sequence number, and presigned url.
pub(crate) async fn file_init_data(
    state: &State,
    file_id: Uuid,
) -> Result<GetFileInitDataResponse> {
    get_file_init_data(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        file_id,
    )
    .await
    .map_err(|e| api_error(e, "Get file init data"))
}

/// Get the scheduled tasks to run.
///
/// Scheduled tasks include the file id, task id, next run time, and operations.
pub(crate) async fn scheduled_tasks(state: &State) -> Result<Vec<TaskRun>> {
    get_scheduled_tasks(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
    )
    .await
    .map_err(|e| api_error(e, "Get scheduled tasks"))
    .map(|tasks| tasks.into_iter().map(|task| task.into()).collect())
}

/// Insert a scheduled task log for a scheduled task.
pub(crate) async fn insert_scheduled_task_log(
    state: &State,
    run_id: Uuid,
    scheduled_task_id: Uuid,
    status: ScheduledTaskLogStatus,
    error: Option<String>,
) -> Result<ScheduledTaskLogResponse> {
    create_scheduled_task_log(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        run_id,
        scheduled_task_id,
        status,
        error,
    )
    .await
    .map_err(|e| api_error(e, "Create scheduled task log"))
}

/// Insert pending logs for a scheduled task.
pub(crate) async fn insert_pending_logs(state: &State, ids: Vec<(Uuid, Uuid)>) -> Result<()> {
    for (run_id, task_id) in ids {
        insert_scheduled_task_log(
            state,
            run_id,
            task_id,
            ScheduledTaskLogStatus::PENDING,
            None,
        )
        .await?;

        trace!("Inserted pending log for {task_id} with Quadratic API");
    }

    Ok(())
}

/// Insert a running log for a scheduled task.
pub(crate) async fn insert_running_log(state: &State, tasks: Vec<(Uuid, Uuid)>) -> Result<()> {
    for (run_id, task_id) in tasks {
        insert_scheduled_task_log(
            state,
            run_id,
            task_id,
            ScheduledTaskLogStatus::RUNNING,
            None,
        )
        .await
        .map_err(|e| api_error(e, "Insert running log"))?;
    }

    Ok(())
}

/// Insert a completed log for a scheduled task.
pub(crate) async fn insert_completed_logs(
    state: &State,
    tasks: Vec<(String, Uuid, Uuid)>,
) -> Result<()> {
    for (_, run_id, task_id) in tasks {
        insert_scheduled_task_log(
            state,
            run_id,
            task_id,
            ScheduledTaskLogStatus::COMPLETED,
            None,
        )
        .await
        .map_err(|e| api_error(e, "Insert completed log"))?;
    }

    Ok(())
}

/// Insert a failed log for a scheduled task.
pub(crate) async fn insert_failed_logs(
    state: &State,
    tasks: Vec<(String, Uuid, Uuid, String)>,
) -> Result<()> {
    for (_, run_id, task_id, error) in tasks {
        insert_scheduled_task_log(
            state,
            run_id,
            task_id,
            ScheduledTaskLogStatus::FAILED,
            Some(error),
        )
        .await
        .map_err(|e| api_error(e, "Insert failed log"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::new_state;
    use chrono::Utc;
    use httpmock::prelude::*;
    use serial_test::serial;

    fn mock_log_response(run_id: Uuid, status: &str, error: Option<&str>) -> serde_json::Value {
        serde_json::json!({
            "id": 1,
            "scheduledTaskId": 1,
            "runId": run_id,
            "status": status,
            "error": error,
            "createdDate": Utc::now().to_rfc3339()
        })
    }

    fn mock_server() -> MockServer {
        let server = MockServer::start();

        unsafe {
            std::env::set_var("QUADRATIC_API_URI", server.base_url());
        }

        server
    }

    #[tokio::test]
    #[serial]
    async fn test_file_init_data() {
        let server = mock_server();
        let file_id = Uuid::new_v4();

        let mock = server.mock(|when, then| {
            when.method(GET)
                .path(format!("/v0/internal/file/{}/init-data", file_id));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(serde_json::json!({
                    "teamId": "00000000-0000-0000-0000-000000000000",
                    "email": "test@example.com",
                    "sequenceNumber": 0,
                    "presignedUrl": "https://example.com/file.grid",
                    "timezone": "UTC"
                }));
        });
        let state = new_state().await;
        let result = file_init_data(&state, file_id).await;

        mock.assert();
        assert!(result.is_ok());
        let data = result.unwrap();
        assert_eq!(data.sequence_number, 0);
    }

    #[tokio::test]
    #[serial]
    async fn test_scheduled_tasks() {
        let server = mock_server();
        let mock = server.mock(|when, then| {
            when.method(GET).path("/v0/internal/scheduled-tasks");
            then.status(200)
                .header("content-type", "application/json")
                .json_body(serde_json::json!([]));
        });
        let state = new_state().await;
        let result = scheduled_tasks(&state).await;

        mock.assert();
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial]
    async fn test_insert_pending_logs() {
        let server = mock_server();
        let run_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();

        let mock = server.mock(|when, then| {
            when.method(POST)
                .path(format!("/v0/internal/scheduled-tasks/{}/log", task_id));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(mock_log_response(run_id, "PENDING", None));
        });
        let state = new_state().await;
        let ids = vec![(run_id, task_id)];
        let result = insert_pending_logs(&state, ids).await;

        mock.assert();
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[serial]
    async fn test_insert_running_log() {
        let server = mock_server();
        let run_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();

        let mock = server.mock(|when, then| {
            when.method(POST)
                .path(format!("/v0/internal/scheduled-tasks/{}/log", task_id));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(mock_log_response(run_id, "RUNNING", None));
        });
        let state = new_state().await;
        let tasks = vec![(run_id, task_id)];
        let result = insert_running_log(&state, tasks).await;

        mock.assert();
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[serial]
    async fn test_insert_completed_logs() {
        let server = mock_server();
        let run_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();

        let mock = server.mock(|when, then| {
            when.method(POST)
                .path(format!("/v0/internal/scheduled-tasks/{}/log", task_id));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(mock_log_response(run_id, "COMPLETED", None));
        });
        let state = new_state().await;
        let tasks = vec![("worker-1".to_string(), run_id, task_id)];
        let result = insert_completed_logs(&state, tasks).await;

        mock.assert();
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[serial]
    async fn test_insert_failed_logs() {
        let server = mock_server();
        let run_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();

        let mock = server.mock(|when, then| {
            when.method(POST)
                .path(format!("/v0/internal/scheduled-tasks/{}/log", task_id));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(mock_log_response(run_id, "FAILED", Some("test error")));
        });
        let state = new_state().await;
        let tasks = vec![(
            "worker-1".to_string(),
            run_id,
            task_id,
            "test error".to_string(),
        )];
        let result = insert_failed_logs(&state, tasks).await;

        mock.assert();
        assert!(result.is_ok());
    }
}
