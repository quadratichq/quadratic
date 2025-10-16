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
