use axum::{
    body::to_bytes,
    debug_handler,
    extract::{Path, Request},
    response::IntoResponse,
    Extension, Json,
};
use quadratic_rust_shared::storage::Storage;
use serde::Serialize;
use std::sync::Arc;

use crate::error::{FilesError, Result};
use crate::state::State;

#[derive(Debug, Serialize)]
pub(crate) struct UploadStorageResponse {
    bucket: String,
    key: String,
}

#[debug_handler]
pub(crate) async fn get_storage(
    Path(file_name): Path<String>,
    state: Extension<Arc<State>>,
) -> Result<impl IntoResponse> {
    tracing::info!("Get file {}", file_name,);

    let file = state.settings.storage.read(&file_name).await?;
    Ok(file.into_response())
}

#[debug_handler]
pub(crate) async fn upload_storage(
    Path(file_name): Path<String>,
    state: Extension<Arc<State>>,
    request: Request,
) -> Result<Json<UploadStorageResponse>> {
    tracing::info!(
        "Uploading file {} to {}",
        file_name,
        state.settings.storage.path()
    );

    let bytes = to_bytes(request.into_body(), usize::MAX)
        .await
        .map_err(|e| FilesError::Storage(e.to_string()))?;

    state.settings.storage.write(&file_name, &bytes).await?;

    Ok(Json(UploadStorageResponse {
        bucket: state.settings.storage.path().to_owned(),
        key: file_name,
    }))
}
