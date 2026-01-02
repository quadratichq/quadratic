use axum::extract::ws::{Message, WebSocket};
use chrono::{DateTime, Utc};
use futures_util::stream::SplitSink;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::{MpError, Result};
use crate::state::State;
use crate::{get_mut_room, get_room};
use quadratic_rust_shared::multiplayer::message::{UserState, UserStateUpdate};
use quadratic_rust_shared::quadratic_api::FilePermRole;

pub(crate) type UserSocket = Arc<Mutex<SplitSink<WebSocket, Message>>>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub(crate) struct User {
    pub session_id: Uuid,
    pub user_id: String,
    pub connection_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub image: String,
    pub index: usize,
    pub permissions: Vec<FilePermRole>,
    #[serde(flatten)]
    pub state: UserState,
    #[serde(skip)]
    pub socket: Option<UserSocket>,
    #[serde(skip)]
    pub last_heartbeat: DateTime<Utc>,
}

impl From<User> for quadratic_rust_shared::multiplayer::message::User {
    fn from(val: User) -> Self {
        quadratic_rust_shared::multiplayer::message::User {
            session_id: val.session_id,
            user_id: val.user_id,
            connection_id: val.connection_id,
            first_name: val.first_name,
            last_name: val.last_name,
            email: val.email,
            image: val.image,
            index: val.index,
            permissions: val.permissions,
            state: val.state,
        }
    }
}

impl PartialEq for User {
    fn eq(&self, other: &Self) -> bool {
        self.session_id == other.session_id
            && self.user_id == other.user_id
            && self.first_name == other.first_name
            && self.last_name == other.last_name
            && self.image == other.image
    }
}

impl State {
    /// Retrieves a copy of a user in a room
    pub(crate) async fn _get_user_in_room(
        &self,
        file_id: &Uuid,
        session_id: &Uuid,
    ) -> Result<User> {
        let user = get_room!(self, file_id)?
            .users
            .get(session_id)
            .ok_or(MpError::Unknown(format!(
                "User {session_id} not found in Room {file_id}"
            )))?
            .to_owned();

        Ok(user)
    }

    /// Remove stale users in a room.  Returns the number of users removed in the room, and the number left.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn remove_stale_users_in_room(
        &self,
        file_id: Uuid,
        heartbeat_timeout_s: i64,
    ) -> Result<(usize, usize)> {
        let mut num_active_users = 0;
        let stale_users = get_room!(self, file_id)?
            .users
            .iter()
            .filter(|user| {
                let no_heartbeat =
                    user.last_heartbeat.timestamp() + heartbeat_timeout_s < Utc::now().timestamp();

                if !no_heartbeat {
                    num_active_users += 1;
                }

                no_heartbeat
            })
            .map(|user| user.to_owned())
            .collect::<Vec<User>>();

        for user in stale_users.iter() {
            tracing::info!(
                "Removing stale user {} from room {}",
                user.session_id,
                file_id
            );

            self.leave_room(file_id, &user.session_id).await?;
            self.connections.lock().await.remove(&user.connection_id);
        }

        Ok((stale_users.len(), num_active_users))
    }

    /// Updates a user's heartbeat in a room
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn update_user_heartbeat(
        &self,
        file_id: Uuid,
        session_id: &Uuid,
    ) -> Result<()> {
        get_mut_room!(self, file_id)?
            .users
            .entry(session_id.to_owned())
            .and_modify(|user| {
                user.last_heartbeat = Utc::now();
                tracing::trace!("Updating heartbeat for {session_id}");
            });

        Ok(())
    }

    /// Updates a user's permissions in a room
    #[tracing::instrument(level = "trace")]
    #[cfg(test)]
    pub(crate) async fn update_user_permissions(
        &self,
        file_id: Uuid,
        session_id: &Uuid,
        permissions: Vec<FilePermRole>,
    ) -> Result<()> {
        get_mut_room!(self, file_id)?
            .users
            .entry(session_id.to_owned())
            .and_modify(|user| user.permissions = permissions);

        Ok(())
    }

    /// updates a user's state in a room
    pub(crate) async fn update_user_state(
        &self,
        file_id: &Uuid,
        session_id: &Uuid,
        user_state: &UserStateUpdate,
    ) -> Result<()> {
        get_mut_room!(self, file_id)?
            .users
            .entry(session_id.to_owned())
            .and_modify(|user| {
                if let Some(sheet_id) = user_state.sheet_id {
                    user.state.sheet_id = sheet_id;
                }
                if let Some(selection) = &user_state.selection {
                    selection.clone_into(&mut user.state.selection);
                }
                if let Some(x) = user_state.x {
                    user.state.x = x;
                }
                if let Some(y) = user_state.y {
                    user.state.y = y;
                }
                if let Some(visible) = user_state.visible {
                    user.state.visible = visible;
                }
                if let Some(cell_edit) = user_state.cell_edit.to_owned() {
                    user.state.cell_edit = cell_edit;
                }
                if let Some(viewport) = user_state.viewport.to_owned() {
                    user.state.viewport = viewport;
                }
                if let Some(follow) = user_state.follow.to_owned() {
                    if follow.is_empty() {
                        user.state.follow = None;
                    } else {
                        user.state.follow = Uuid::parse_str(&follow).ok();
                    }
                }

                user.last_heartbeat = Utc::now();
            });

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::{error::MpError, test_util::setup};
    use quadratic_rust_shared::multiplayer::message::CellEdit;

    #[tokio::test]
    async fn removes_stale_users_in_room() {
        // add 2 users to a room
        let (_, state, _, file_id, _, _) = setup().await;
        assert_eq!(get_room!(state, file_id).unwrap().users.len(), 2);

        // remove stale users in the room until the room is empty
        loop {
            match state.get_room(&file_id).await {
                Ok(_) => {
                    state.remove_stale_users_in_room(file_id, 0).await.unwrap();
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }
                Err(error) => {
                    assert!(matches!(error, MpError::RoomNotFound(_)));
                    break;
                }
            };
        }
    }

    #[tokio::test]
    async fn updates_a_users_heartbeat() {
        let (_, state, _, file_id, user, _) = setup().await;

        let old_heartbeat = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap()
            .last_heartbeat;

        state
            .update_user_heartbeat(file_id, &user.session_id)
            .await
            .unwrap();

        let new_heartbeat = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap()
            .last_heartbeat;

        assert!(old_heartbeat < new_heartbeat);
    }

    #[tokio::test]
    async fn updates_a_users_permissions() {
        let (_, state, _, file_id, user, _) = setup().await;
        let get_user_perms = || async {
            state
                ._get_user_in_room(&file_id, &user.session_id)
                .await
                .unwrap()
                .permissions
        };
        let expected = vec![FilePermRole::FileView, FilePermRole::FileEdit];
        assert_eq!(get_user_perms().await, expected);

        let perms = vec![
            FilePermRole::FileView,
            FilePermRole::FileEdit,
            FilePermRole::FileDelete,
        ];
        state
            .update_user_permissions(file_id, &user.session_id, perms.clone())
            .await
            .unwrap();
        assert_eq!(get_user_perms().await, perms);
    }

    #[tokio::test]
    async fn follow_updates() {
        let (_, state, _, file_id, user, _) = setup().await;

        let user_state = UserStateUpdate {
            follow: Some(user.session_id.to_string()),
            ..Default::default()
        };

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert_eq!(user.state.follow, Some(user.session_id));

        let user_state = UserStateUpdate {
            follow: Some("".to_string()),
            ..Default::default()
        };

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert_eq!(user.state.follow, None);
    }

    #[tokio::test]
    async fn follow_updates_invalid_uuid() {
        let (_, state, _, file_id, user, _) = setup().await;

        let user_state = UserStateUpdate {
            follow: Some("invalid".to_string()),
            ..Default::default()
        };

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert_eq!(user.state.follow, None);
    }

    #[tokio::test]
    async fn user_visible_update() {
        let (_, state, _, file_id, user, _) = setup().await;

        let user_state = UserStateUpdate {
            visible: Some(false),
            ..Default::default()
        };

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert!(!user.state.visible);

        let user_state = UserStateUpdate {
            visible: Some(true),
            ..Default::default()
        };

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert!(user.state.visible);
    }

    #[tokio::test]
    async fn user_sheet_id_update() {
        let (_, state, _, file_id, user, _) = setup().await;

        let mut user_state = UserStateUpdate::default();
        let sheet_id = Uuid::new_v4();
        user_state.sheet_id = Some(sheet_id);

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert_eq!(user.state.sheet_id, sheet_id);

        let mut user_state = UserStateUpdate::default();
        let sheet_id = Uuid::new_v4();
        user_state.sheet_id = Some(sheet_id);

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert_eq!(user.state.sheet_id, sheet_id);
    }

    #[tokio::test]
    async fn user_cell_edit_update() {
        let (_, state, _, file_id, user, _) = setup().await;

        let mut user_state = UserStateUpdate::default();
        let cell_edit = CellEdit {
            active: true,
            text: "hello".to_string(),
            cursor: 0,
            code_editor: false,
            inline_code_editor: false,
            bold: None,
            italic: None,
        };
        user_state.cell_edit = Some(cell_edit.clone());

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert_eq!(user.state.cell_edit, cell_edit);

        let mut user_state = UserStateUpdate::default();
        let cell_edit = CellEdit {
            active: false,
            text: "hello".to_string(),
            cursor: 0,
            code_editor: false,
            inline_code_editor: false,
            bold: None,
            italic: None,
        };
        user_state.cell_edit = Some(cell_edit.clone());

        state
            .update_user_state(&file_id, &user.session_id, &user_state)
            .await
            .unwrap();

        let user = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap();

        assert_eq!(user.state.cell_edit, cell_edit);
    }
}
