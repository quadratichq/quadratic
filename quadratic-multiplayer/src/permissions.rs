use std::sync::Arc;

use quadratic_rust_shared::quadratic_api::{can_edit, can_view, FilePermRole};
use uuid::Uuid;

use crate::{
    error::{MpError, Result},
    state::State,
};

pub(crate) fn validate_can_edit_or_view_file(roles: &[FilePermRole]) -> Result<()> {
    if !(can_view(roles) || can_edit(roles)) {
        return Err(MpError::FilePermissions(
            "You do not have permission to access this file".to_string(),
        ));
    }

    Ok(())
}

pub(crate) fn validate_can_edit_file(roles: &[FilePermRole]) -> Result<()> {
    if !can_edit(roles) {
        return Err(MpError::FilePermissions(
            "You do not have permission to edit this file".to_string(),
        ));
    }

    Ok(())
}

pub(crate) async fn validate_user_can_edit_or_view_file(
    state: Arc<State>,
    file_id: Uuid,
    session_id: Uuid,
) -> Result<()> {
    let user = state.get_room(&file_id).await?.get_user(&session_id)?;

    validate_can_edit_or_view_file(&user.permissions)
}

pub(crate) async fn validate_user_can_edit_file(
    state: Arc<State>,
    file_id: Uuid,
    session_id: Uuid,
) -> Result<()> {
    let user = state.get_room(&file_id).await?.get_user(&session_id)?;

    validate_can_edit_file(&user.permissions)
}
