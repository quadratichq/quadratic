//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod connection;
pub mod room;
pub mod transaction_queue;
pub mod user;

use jsonwebtoken::jwk::JwkSet;
use std::collections::HashMap;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::state::room::Room;
use crate::state::transaction_queue::TransactionQueue;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) rooms: Mutex<HashMap<Uuid, Room>>,
    pub(crate) connections: Mutex<HashMap<Uuid, Uuid>>,
    pub(crate) transaction_queue: Mutex<TransactionQueue>,
    pub(crate) settings: Settings,
}

#[derive(Debug, Default)]
pub(crate) struct Settings {
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) authenticate_jwt: bool,
    pub(crate) quadratic_api_uri: String,
}

impl State {
    pub(crate) fn new() -> Self {
        // TODO(ddimaria): seed transaction_queue with the sequence_num from the database for each file
        State {
            rooms: Mutex::new(HashMap::new()),
            connections: Mutex::new(HashMap::new()),
            transaction_queue: Mutex::new(TransactionQueue::new()),
            settings: Settings::default(),
        }
    }

    pub(crate) fn with_settings(mut self, settings: Settings) -> Self {
        self.settings = settings;
        self
    }
}
