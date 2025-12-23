use dashmap::DashMap;
use quadratic_rust_shared::multiplayer::message::response::{MessageResponse, MinVersion};
use quadratic_rust_shared::net::websocket_server::pre_connection::PreConnection;
use quadratic_rust_shared::quadratic_api::get_file_checkpoint;
use serde::Serialize;
use uuid::Uuid;

use crate::error::{MpError, Result};
use crate::state::{State, user::User};
use crate::{get_mut_room, get_room};

use super::connection::Connection;

#[derive(Serialize, Debug, Clone)]
pub(crate) struct Room {
    pub(crate) file_id: Uuid,
    pub(crate) users: DashMap<Uuid, User>,
    pub(crate) sequence_num: u64,
    pub(crate) checkpoint_sequence_num: u64,
    pub(crate) user_index: usize,
}

#[cfg(test)]
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
            user_index: 0,
        }
    }

    pub fn increment_sequence_num(&mut self) -> u64 {
        self.sequence_num += 1;
        self.sequence_num
    }

    pub fn get_user(&self, session_id: &Uuid) -> Result<User> {
        let user = self
            .users
            .get(session_id)
            .ok_or(MpError::UserNotFound(*session_id, self.file_id))?;

        Ok(user.to_owned())
    }

    /// Gets the next user index and increments the user index to prepare for the next user.
    pub fn user_index_increment(&mut self) -> usize {
        let index = self.user_index;
        self.user_index += 1;
        index
    }

    /// Get the number of users in the room.
    pub fn num_users(&self) -> u64 {
        self.users.len() as u64
    }

    pub fn to_users_in_room_response(&self, version: &str) -> MessageResponse {
        MessageResponse::UsersInRoom {
            users: self
                .users
                .iter()
                .map(|user_ref| user_ref.value().to_owned().into())
                .collect(),
            version: version.to_string(),

            // TODO: to be deleted after next version
            min_version: MinVersion {
                required_version: 5,
                recommended_version: 5,
            },
        }
    }
}

impl State {
    /// Retrieves a copy of a room.
    pub(crate) async fn get_room(&self, file_id: &Uuid) -> Result<Room> {
        let room = get_room!(self, file_id)?.to_owned();

        Ok(room)
    }

    /// Add a user to a room.  If the room doesn't exist, it is created.  Users
    /// are only added to a room once (DashMap).  Returns true if the user was
    /// newly added.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn enter_room(
        &self,
        file_id: Uuid,
        user: &mut User,
        mut pre_connection: PreConnection,
        sequence_num: u64,
    ) -> Result<bool> {
        let sequence_num = self.get_max_sequence_num(file_id, sequence_num).await?;
        let rooms = self.rooms.lock().await;
        let mut room = rooms.entry(file_id).or_insert_with(|| {
            tracing::info!(
                "Room {} created with sequence_num {}",
                file_id,
                sequence_num
            );

            Room::new(file_id, sequence_num)
        });

        user.index = room.user_index_increment();

        let is_new = room
            .users
            .insert(user.session_id.to_owned(), user.to_owned())
            .is_none();

        let connection = Connection::new(
            pre_connection.id,
            user.session_id,
            file_id,
            pre_connection.jwt.take(),
        );

        self.connections
            .lock()
            .await
            .insert(connection.id, connection);

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

    /// Get a room's current sequence number.
    pub(crate) async fn get_sequence_num(&self, file_id: &Uuid) -> Result<u64> {
        Ok(get_room!(self, file_id)?.sequence_num)
    }

    /// Get the maximum sequence number for a room.
    /// If the room doesn't exist in memory, get the latest checkpoint from
    /// quadratic api.
    pub(crate) async fn get_max_sequence_num(
        &self,
        file_id: Uuid,
        sequence_num: u64,
    ) -> Result<u64> {
        let sequence_num: u64 = match get_room!(self, file_id) {
            Ok(room) => room.sequence_num.max(sequence_num),
            Err(_) => {
                if cfg!(test) {
                    0
                } else {
                    let url = &self.settings.quadratic_api_uri;
                    let jwt = &self.settings.m2m_auth_token;
                    let response = get_file_checkpoint(url, jwt, &file_id)
                        .await?
                        .sequence_number
                        .max(sequence_num);

                    tracing::info!(
                        "Retrieved sequence number {} for room {}",
                        response,
                        file_id
                    );
                    response
                }
            }
        };

        Ok(sequence_num)
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
            .ok_or($crate::error::MpError::RoomNotFound($file_id.to_string()))
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
            .ok_or($crate::error::MpError::RoomNotFound($file_id.to_string()))
    };
}

#[cfg(test)]
mod tests {
    use crate::test_util::{new_state, new_user};

    use super::*;

    #[tokio::test]
    async fn enters_retrieves_leaves_and_removes_a_room() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let mut user = new_user(0);
        let mut user2 = new_user(1);
        let connection = PreConnection::new(None, None, None);
        let connection2 = PreConnection::new(None, None, None);

        let is_new = state
            .enter_room(file_id, &mut user, connection, 0)
            .await
            .unwrap();
        let room = state.get_room(&file_id).await.unwrap();
        let user = room.get_user(&user.session_id).unwrap();

        assert!(is_new);
        assert_eq!(state.rooms.lock().await.len(), 1);
        assert_eq!(room.users.len(), 1);
        assert_eq!(user.index, 0);

        let sequence_num = state.get_sequence_num(&file_id).await.unwrap();
        assert_eq!(sequence_num, 0);

        get_mut_room!(state, file_id)
            .unwrap()
            .increment_sequence_num();
        let sequence_num = state.get_sequence_num(&file_id).await.unwrap();
        assert_eq!(sequence_num, 1);

        // leave the room of 2 users
        state
            .enter_room(file_id, &mut user2, connection2, 0)
            .await
            .unwrap();
        state.leave_room(file_id, &user.session_id).await.unwrap();
        let room = state.get_room(&file_id).await.unwrap();

        assert_eq!(room.users.len(), 1);
        assert_eq!(room.users.get(&user2.session_id).unwrap().value(), &user2);
        assert_eq!(user2.index, 1);

        // leave a room of 1 user
        state.leave_room(file_id, &user2.session_id).await.unwrap();
        let room = state.get_room(&file_id).await;
        assert!(room.is_err());
    }

    #[tokio::test]
    async fn user_gets_assigned_indices() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let mut user = new_user(0);
        let mut user2 = new_user(1);
        let mut user3 = new_user(2);
        let connection = PreConnection::new(None, None, None);
        let connection2 = PreConnection::new(None, None, None);
        let connection3 = PreConnection::new(None, None, None);
        let connection4 = PreConnection::new(None, None, None);

        state
            .enter_room(file_id, &mut user, connection, 0)
            .await
            .unwrap();
        state
            .enter_room(file_id, &mut user2, connection2, 0)
            .await
            .unwrap();
        state
            .enter_room(file_id, &mut user3, connection3, 0)
            .await
            .unwrap();
        assert_eq!(user.index, 0);
        assert_eq!(user2.index, 1);
        assert_eq!(user3.index, 2);
        state.leave_room(file_id, &user2.session_id).await.unwrap();
        state
            .enter_room(file_id, &mut user2, connection4, 0)
            .await
            .unwrap();
        assert_eq!(user2.index, 3);
    }
}
