use axum::{
    body::to_bytes,
    extract::{Path, Request},
    response::IntoResponse,
    Extension, Json,
};
use quadratic_rust_shared::{
    crypto::aes_cbc::decrypt_from_api,
    storage::{Storage, StorageConfig},
};
use serde::Serialize;
use std::sync::Arc;

use crate::error::{FilesError, Result};
use crate::state::State;

#[derive(Debug, Serialize)]
pub(crate) struct UploadStorageResponse {
    bucket: String,
    key: String,
}

/// Get a file from storage
pub(crate) async fn get_storage(
    Path(file_name): Path<String>,
    state: Extension<Arc<State>>,
) -> Result<impl IntoResponse> {
    tracing::trace!("Get file {}", file_name);

    let file = state.settings.storage.read(&file_name).await?;
    Ok(file.into_response())
}

/// Get a file from storage from a presigned URL (encrypted)
pub(crate) async fn get_presigned_storage(
    Path(encrypted_file_name): Path<String>,
    state: Extension<Arc<State>>,
) -> Result<impl IntoResponse> {
    tracing::trace!("Get presigned file {}", encrypted_file_name);

    match state.settings.storage.config() {
        StorageConfig::FileSystem(config) => {
            // For now, we only support one encryption key.
            // In the future, implement key traversal on decryption failures.
            let key = config
                .encryption_keys
                .first()
                .ok_or(FilesError::Storage("No encryption keys found".to_string()))?;
            let file_name = decrypt_from_api(key, &encrypted_file_name)?;
            let file = state.settings.storage.read(&file_name).await?;

            Ok(file.into_response())
        }
        _ => Err(FilesError::Storage(
            "Presigned URLs supported in FileSystem storage options".to_string(),
        )),
    }
}

/// Upload a file to storage
pub(crate) async fn upload_storage(
    Path(file_name): Path<String>,
    state: Extension<Arc<State>>,
    request: Request,
) -> Result<Json<UploadStorageResponse>> {
    tracing::trace!(
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
