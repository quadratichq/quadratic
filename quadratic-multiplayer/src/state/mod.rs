//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod room;
pub mod user;

use std::collections::HashMap;

use anyhow::{anyhow, Result};

use tokio::sync::Mutex;
use uuid::Uuid;

use crate::state::room::Room;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) rooms: Mutex<HashMap<Uuid, Room>>,
    pub(crate) sessions: Mutex<HashMap<Uuid, Uuid>>,
}

impl State {
    pub(crate) fn new() -> Self {
        State {
            rooms: Mutex::new(HashMap::new()),
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub(crate) async fn get_session_id(&self, internal_session_id: Uuid) -> Result<Uuid> {
        let session_id = self
            .sessions
            .lock()
            .await
            .get(&internal_session_id)
            .ok_or(anyhow!(
                "Internal_session_id {} not found",
                internal_session_id
            ))?
            .to_owned();

        Ok(session_id)
    }

    ///
    pub(crate) async fn clear_internal_sessions(
        &self,
        internal_session_id: Uuid,
    ) -> Result<Vec<Uuid>> {
        let mut affected_rooms = vec![];
        let session_id = self.get_session_id(internal_session_id).await?;
        let rooms = self.rooms.lock().await.clone();

        for (file_id, room) in rooms.iter() {
            if let Some(user) = room.users.get(&session_id) {
                tracing::info!("Removing internal_session_id {session_id} from room {file_id}");

                self.leave_room(room.file_id, &user.session_id).await?;
                affected_rooms.push(file_id.to_owned());
            }
        }

        tracing::info!("Removing internal_session_id {}", session_id);

        self.sessions.lock().await.remove(&internal_session_id);
        Ok(affected_rooms)
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::new_user;

    use super::*;

    #[tokio::test]
    async fn updates_a_users_heartbeat() {
        let state = State::new();
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user = new_user();

        state.enter_room(file_id, &user, internal_session_id).await;
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
