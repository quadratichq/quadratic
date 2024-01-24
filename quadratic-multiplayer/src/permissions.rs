use std::sync::Arc;

use quadratic_rust_shared::quadratic_api::{can_edit, can_view, FilePermRole};
use uuid::Uuid;

use crate::{
    error::{MpError, Result},
    state::State,
};

pub(crate) fn validate_can_edit_or_view_file(roles: &[FilePermRole]) -> Result<()> {
    if !can_view(roles) || !can_edit(roles) {
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

#[cfg(test)]
pub(crate) mod tests {

    use crate::test_util::setup;

    use super::*;

    #[tokio::test]
    async fn validates_can_edit_or_view_file() {
        let roles = vec![FilePermRole::FileView, FilePermRole::FileEdit];
        let result = validate_can_edit_or_view_file(&roles);
        assert!(result.is_ok());

        let roles = vec![FilePermRole::FileDelete];
        let result = validate_can_edit_or_view_file(&roles);
        assert!(matches!(result, Err(MpError::FilePermissions(_))));
    }

    #[tokio::test]
    async fn validates_can_edit_file() {
        let roles = vec![FilePermRole::FileView, FilePermRole::FileEdit];
        let result = validate_can_edit_file(&roles);
        assert!(result.is_ok());

        let roles = vec![FilePermRole::FileView];
        let result = validate_can_edit_file(&roles);
        assert!(matches!(result, Err(MpError::FilePermissions(_))));
    }

    #[tokio::test]
    async fn validates_user_can_edit_or_view_file() {
        let (_, state, _, file_id, user, _) = setup().await;
        let session_id = user.session_id;

        let roles = vec![FilePermRole::FileView, FilePermRole::FileEdit];
        let result = validate_user_can_edit_or_view_file(state.clone(), file_id, session_id).await;
        // assert!(result.is_ok());

        // let roles = vec![FilePermRole::FileDelete];
        // let result = validate_user_can_edit_or_view_file(&roles);
        // assert!(matches!(result, Err(MpError::FilePermissions(_))));
    }
}
