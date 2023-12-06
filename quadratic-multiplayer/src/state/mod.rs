//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod connection;
pub mod room;
pub mod user;

use std::collections::HashMap;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::state::room::Room;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) rooms: Mutex<HashMap<Uuid, Room>>,
    pub(crate) connections: Mutex<HashMap<Uuid, Uuid>>,
}

impl State {
    pub(crate) fn new() -> Self {
        State {
            rooms: Mutex::new(HashMap::new()),
            connections: Mutex::new(HashMap::new()),
        }
    }
}
