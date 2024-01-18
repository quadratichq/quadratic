use dashmap::DashMap;
use serde::Serialize;
use uuid::Uuid;

use crate::error::Result;
use crate::state::{user::User, State};
use crate::{get_mut_room, get_or_create_room, get_room};

#[derive(Serialize, Debug, Clone)]
pub(crate) struct Room {
    pub(crate) file_id: Uuid,
    pub(crate) users: DashMap<Uuid, User>,
    pub(crate) sequence_num: u64,
    pub(crate) checkpoint_sequence_num: u64,
}

impl PartialEq for Room {
    fn eq(&self, other: &Self) -> bool {
        self.file_id == other.file_id
            && self.sequence_num == other.sequence_num
            && self.users.len() == other.users.len()
    }
}

impl Room {
    pub(crate) fn new(file_id: Uuid, sequence_num: u64) -> Self {
        Room {
            file_id,
            users: DashMap::new(),
            sequence_num,
            checkpoint_sequence_num: sequence_num,
        }
    }

    pub fn increment_sequence_num(&mut self) -> u64 {
        self.sequence_num += 1;
        self.sequence_num
    }

    pub fn set_checkpoint_sequence_num(&mut self, sequence_num: u64) {
        self.checkpoint_sequence_num = sequence_num;
    }
}

impl State {
    /// Retrieves a copy of a room.
    pub(crate) async fn get_room(&self, file_id: &Uuid) -> Result<Room> {
        let room = get_room!(self, file_id)?.to_owned();

        Ok(room)
    }

    pub(crate) async fn set_checkpoint_sequence_num(
        &self,
        file_id: &Uuid,
        sequence_num: u64,
    ) -> Result<()> {
        get_mut_room!(self, file_id)?.set_checkpoint_sequence_num(sequence_num);
        Ok(())
    }

    /// Add a user to a room.  If the room doesn't exist, it is created.  Users
    /// are only added to a room once (DashMap).  Returns true if the user was
    /// newly added.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn enter_room(
        &self,
        file_id: Uuid,
        user: &User,
        connection_id: Uuid,
        sequence_num: u64,
    ) -> Result<bool> {
        let is_new = get_or_create_room!(self, file_id, sequence_num)
            .users
            .insert(user.session_id.to_owned(), user.to_owned())
            .is_none();

        self.connections
            .lock()
            .await
            .insert(connection_id, user.session_id);

        tracing::info!("User {:?} entered room {:?}", user.session_id, file_id);

        Ok(is_new)
    }

    /// Removes a user from a room. If the room is empty, it deletes the room.
    /// Returns true if the room still exists after the user leaves.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn leave_room(&self, file_id: Uuid, session_id: &Uuid) -> Result<bool> {
        get_mut_room!(self, file_id)?.users.remove(session_id);
        let num_in_room = get_room!(self, file_id)?.users.len();

        tracing::info!(
            "User {:?} is leaving room {}, {} user(s) left",
            session_id,
            file_id,
            num_in_room
        );

        if num_in_room == 0 {
            tracing::info!("Empty room {}.", file_id);
            self.remove_room(file_id).await;
        }

        Ok(num_in_room != 0)
    }

    /// Removes a room.
    pub(crate) async fn remove_room(&self, file_id: Uuid) {
        self.rooms.lock().await.remove(&file_id);

        tracing::info!("Room {file_id} removed");
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
            .ok_or($crate::error::MpError::Room(format!(
                "Room {} not found",
                $file_id
            )))
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
            .ok_or($crate::error::MpError::Room(format!(
                "Room {} not found",
                $file_id
            )))
    };
}

#[macro_export]
macro_rules! get_or_create_room {
    ( $self:ident, $file_id:ident, $sequence_num:ident ) => {{
        let sequence_num = match get_room!($self, $file_id) {
            Ok(room) => $sequence_num.max(room.sequence_num),
            Err(_) => {
                if cfg!(test) {
                    0
                } else {
                    let url = &$self.settings.quadratic_api_uri;
                    let jwt = &$self.settings.quadratic_api_jwt;
                    quadratic_rust_shared::quadratic_api::get_file_checkpoint(url, jwt, &$file_id)
                        .await?
                        .sequence_number
                        .max($sequence_num)
                }
            }
        };

        $self.rooms.lock().await.entry($file_id).or_insert_with(|| {
            tracing::info!(
                "Room {} created with sequence_num {}",
                $file_id,
                $sequence_num
            );

            Room::new($file_id, sequence_num)
        })
    }};
}

#[cfg(test)]
mod tests {
    use crate::test_util::{new_state, new_user};

    use super::*;

    #[tokio::test]
    async fn enters_retrieves_leaves_and_removes_a_room() {
        let state = new_state().await;
        let connection_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user = new_user();
        let user2 = new_user();

        let is_new = state
            .enter_room(file_id, &user, connection_id, 0)
            .await
            .unwrap();
        let room = state.get_room(&file_id).await.unwrap();
        let user = room.users.get(&user.session_id).unwrap();

        assert!(is_new);
        assert_eq!(state.rooms.lock().await.len(), 1);
        assert_eq!(room.users.len(), 1);
        assert_eq!(
            room.users.get(&user.session_id).unwrap().value(),
            user.value()
        );

        // leave the room of 2 users
        state
            .enter_room(file_id, &user2, connection_id, 0)
            .await
            .unwrap();
        state.leave_room(file_id, &user.session_id).await.unwrap();
        let room = state.get_room(&file_id).await.unwrap();

        assert_eq!(room.users.len(), 1);
        assert_eq!(room.users.get(&user2.session_id).unwrap().value(), &user2);

        // leave a room of 1 user
        state.leave_room(file_id, &user2.session_id).await.unwrap();
        let room = state.get_room(&file_id).await;
        assert!(room.is_err());
    }
}
