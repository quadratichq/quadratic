//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

use std::{collections::HashMap, sync::Arc};

use anyhow::{anyhow, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use serde::Serialize;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Serialize, Debug, Clone)]
pub(crate) struct User {
    #[serde(skip_serializing)]
    pub(crate) id: Uuid,
    pub(crate) first_name: String,
    pub(crate) last_name: String,
    pub(crate) image: String,
    #[serde(skip_serializing)]
    pub(crate) socket: Option<Arc<Mutex<SplitSink<WebSocket, Message>>>>,
}

impl PartialEq for User {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
            && self.first_name == other.first_name
            && self.last_name == other.last_name
            && self.image == other.image
    }
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub(crate) struct Room {
    pub(crate) file_id: Uuid,
    pub(crate) users: HashMap<Uuid, User>,
}

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) rooms: Mutex<HashMap<Uuid, Room>>,
}

impl State {
    pub(crate) fn new() -> Self {
        State {
            rooms: Mutex::new(HashMap::new()),
        }
    }

    /// Add a user to a room.  If the room doesn't exist, it is created.  Users
    /// are only added to a room once (HashMap).
    pub(crate) async fn enter_room(&self, file_id: Uuid, user: User) -> bool {
        let mut rooms = self.rooms.lock().await;
        let room = rooms.entry(file_id).or_insert_with(|| Room {
            file_id,
            users: HashMap::new(),
        });

        tracing::trace!("User {:?} entered room {:?}", user, room);

        room.users.insert(user.id, user).is_none()
    }

    /// Retrieves a copy of a room.
    pub(crate) async fn get_room(&self, file_id: &Uuid) -> Result<Room> {
        let rooms = self.rooms.lock().await;
        let room = rooms
            .get(file_id)
            .ok_or(anyhow!("Room {file_id} not found"))?
            .to_owned();

        Ok(room)
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::new_user;

    use super::*;

    #[tokio::test]
    async fn enters_and_retrieves_a_room() {
        let state = State::new();
        let file_id = Uuid::new_v4();
        let user = new_user();

        let is_new = state.enter_room(file_id, user.clone()).await;
        let room = state.get_room(&file_id).await.unwrap();
        let user = room.users.get(&user.id).unwrap();

        assert!(is_new);
        assert_eq!(state.rooms.lock().await.len(), 1);
        assert_eq!(room.users.len(), 1);
        assert_eq!(room.users.get(&user.id), Some(user));
    }
}
