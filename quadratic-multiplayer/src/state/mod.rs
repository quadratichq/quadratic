//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod users;

use std::collections::HashMap;

use anyhow::{anyhow, Result};

use chrono::Utc;
use serde::Serialize;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{get_mut_room, get_or_create_room, get_room};

use self::users::{User, UserUpdate};

#[derive(Serialize, Debug, Clone, PartialEq)]
pub(crate) struct Room {
    pub(crate) file_id: Uuid,
    pub(crate) users: HashMap<Uuid, User>,
}

impl Room {
    pub(crate) fn new(file_id: Uuid) -> Self {
        Room {
            file_id,
            users: HashMap::new(),
        }
    }
}

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

    /// Retrieves a copy of a room.
    pub(crate) async fn get_room(&self, file_id: &Uuid) -> Result<Room> {
        let room = get_room!(self, file_id)?.to_owned();

        Ok(room)
    }

    /// Add a user to a room.  If the room doesn't exist, it is created.  Users
    /// are only added to a room once (HashMap).  Returns true if the user was
    /// newly added.
    pub(crate) async fn enter_room(
        &self,
        file_id: Uuid,
        user: &User,
        internal_session_id: Uuid,
    ) -> bool {
        let is_new = get_or_create_room!(self, file_id)
            .users
            .insert(user.session_id.to_owned(), user.to_owned())
            .is_none();

        self.sessions
            .lock()
            .await
            .insert(internal_session_id, user.session_id);

        tracing::trace!("User {:?} entered room {:?}", user.session_id, file_id);

        is_new
    }

    /// Removes a user from a room. If the room is empty, it deletes the room.
    /// Returns true if the room still exists after the user leaves.
    pub(crate) async fn leave_room(&self, file_id: Uuid, session_id: &Uuid) -> Result<bool> {
        get_mut_room!(self, file_id)?.users.remove(session_id);
        let num_in_room = get_room!(self, file_id)?.users.len();

        tracing::trace!(
            "User {:?} is leaving room {}, {} user(s) left",
            session_id,
            file_id,
            num_in_room
        );

        if num_in_room == 0 {
            self.remove_room(file_id).await;
        }

        Ok(num_in_room != 0)
    }

    /// Removes a room.
    pub(crate) async fn remove_room(&self, file_id: Uuid) {
        self.rooms.lock().await.remove(&file_id);

        tracing::trace!("Room {file_id} removed");
    }

    /// Retrieves a copy of a user in a room
    pub(crate) async fn _get_user_in_room(
        &self,
        file_id: &Uuid,
        session_id: &Uuid,
    ) -> Result<User> {
        let user = get_room!(self, file_id)?
            .users
            .get(session_id)
            .ok_or(anyhow!("User {} not found in Room {}", session_id, file_id))?
            .to_owned();

        Ok(user)
    }

    /// Remove stale users in a room.  Remove the number of users removed in the room.
    pub(crate) async fn remove_stale_users_in_room(
        &self,
        file_id: Uuid,
        heartbeat_timeout_s: i64,
    ) -> Result<usize> {
        let stale_users = get_room!(self, file_id)?
            .users
            .iter()
            .filter(|(_, user)| {
                user.last_heartbeat.timestamp() + heartbeat_timeout_s < Utc::now().timestamp()
            })
            .map(|(user_id, _)| user_id.to_owned())
            .collect::<Vec<Uuid>>();

        for user_id in stale_users.iter() {
            tracing::info!("Removing stale user {} from room {}", user_id, file_id);

            self.leave_room(file_id, user_id).await?;
        }

        Ok(stale_users.len())
    }

    /// Updates a user's heartbeat in a room
    pub(crate) async fn update_heartbeat(&self, file_id: Uuid, session_id: &Uuid) -> Result<()> {
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
        update: &UserUpdate,
    ) -> Result<()> {
        get_mut_room!(self, file_id)?
            .users
            .entry(session_id.to_owned())
            .and_modify(|user| {
                if let Some(sheet_id) = &update.sheet_id {
                    user.sheet_id = Some(sheet_id.to_owned());
                }
                if let Some(selection) = &update.selection {
                    user.selection = Some(selection.to_owned());
                }
                if let Some(x) = &update.x {
                    user.x = Some(*x);
                }
                if let Some(y) = &update.y {
                    user.y = Some(*y);
                }
                user.last_heartbeat = Utc::now();
                tracing::trace!("Updating sheet_id for {session_id}");
            });

        Ok(())
    }

    /// Updates a user's selection in a room
    pub(crate) async fn update_selection(
        &self,
        file_id: Uuid,
        session_id: &Uuid,
        selection: &String,
    ) -> Result<()> {
        get_mut_room!(self, file_id)?
            .users
            .entry(session_id.to_owned())
            .and_modify(|user| {
                user.selection = Some(selection.to_owned());
                user.last_heartbeat = Utc::now();
                tracing::trace!("Updating selection for {session_id}");
            });

        Ok(())
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

#[macro_export]
macro_rules! get_room {
    ( $self:ident, $file_id:ident ) => {
        $self
            .rooms
            .lock()
            .await
            .get(&$file_id)
            .ok_or(anyhow!("Room {} not found", $file_id))
    };
}

#[macro_export]
macro_rules! get_mut_room {
    ( $self:ident, $file_id:ident ) => {
        $self
            .rooms
            .lock()
            .await
            .get_mut(&$file_id)
            .ok_or(anyhow!("Room {} not found", $file_id))
    };
}

#[macro_export]
macro_rules! get_or_create_room {
    ( $self:ident, $file_id:ident ) => {
        $self.rooms.lock().await.entry($file_id).or_insert_with(|| {
            tracing::trace!("Room {} created", $file_id);
            Room::new($file_id)
        })
    };
}

#[cfg(test)]
mod tests {
    use crate::test_util::new_user;

    use super::*;

    #[tokio::test]
    async fn enters_retrieves_leaves_and_removes_a_room() {
        let state = State::new();
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user = new_user();
        let user2 = new_user();

        let is_new = state.enter_room(file_id, &user, internal_session_id).await;
        let room = state.get_room(&file_id).await.unwrap();
        let user = room.users.get(&user.session_id).unwrap();

        assert!(is_new);
        assert_eq!(state.rooms.lock().await.len(), 1);
        assert_eq!(room.users.len(), 1);
        assert_eq!(room.users.get(&user.session_id), Some(user));

        // leave the room of 2 users
        state.enter_room(file_id, &user2, internal_session_id).await;
        state.leave_room(file_id, &user.session_id).await.unwrap();
        let room = state.get_room(&file_id).await.unwrap();

        assert_eq!(room.users.len(), 1);
        assert_eq!(room.users.get(&user2.session_id), Some(&user2));

        // leave a room of 1 user
        state.leave_room(file_id, &user2.session_id).await.unwrap();
        let room = state.get_room(&file_id).await;
        assert!(room.is_err());
    }

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
            .update_heartbeat(file_id, &user.session_id)
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
