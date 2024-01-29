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
    pub permissions: Vec<FilePermRole>,
    #[serde(flatten)]
    pub state: UserState,
    #[serde(skip)]
    pub socket: Option<UserSocket>,
    #[serde(skip)]
    pub last_heartbeat: DateTime<Utc>,
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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub(crate) struct CellEdit {
    pub active: bool,
    pub text: String,
    pub cursor: u32,
    pub code_editor: bool,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct UserState {
    pub sheet_id: Uuid,
    pub selection: String,
    pub code_running: String,
    pub cell_edit: CellEdit,
    pub x: f64,
    pub y: f64,
    pub visible: bool,
    pub viewport: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct UserStateUpdate {
    pub sheet_id: Option<Uuid>,
    pub selection: Option<String>,
    pub cell_edit: Option<CellEdit>,
    pub code_running: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub visible: Option<bool>,
    pub viewport: Option<String>,
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
                    user.state.selection = selection.to_owned();
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

                user.last_heartbeat = Utc::now();
            });

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        error::MpError,
        state::connection::PreConnection,
        test_util::{new_state, new_user},
    };

    async fn setup() -> (State, PreConnection, Uuid, User) {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let user = new_user();
        let connection = PreConnection::new(None);

        state
            .enter_room(file_id, &user, connection.clone(), 0)
            .await
            .unwrap();

        (state, connection, file_id, user)
    }

    use super::*;
    #[tokio::test]
    async fn removes_stale_users_in_room() {
        // add a user to a room
        let (state, connection, file_id, _) = setup().await;

        // add another user to the room
        let new_user = new_user();
        state
            .enter_room(file_id, &new_user, connection, 0)
            .await
            .unwrap();

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
        let (state, _, file_id, user) = setup().await;

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
}
