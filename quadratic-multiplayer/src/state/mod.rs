//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod connection;
pub mod room;
pub mod settings;
pub mod transaction_queue;
pub mod user;

use jsonwebtoken::jwk::JwkSet;
use std::collections::HashMap;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::Config;
use crate::state::room::Room;
use crate::state::settings::Settings;
use crate::state::transaction_queue::TransactionQueue;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) rooms: Mutex<HashMap<Uuid, Room>>,
    pub(crate) connections: Mutex<HashMap<Uuid, Uuid>>,
    pub(crate) transaction_queue: Mutex<TransactionQueue>,
    pub(crate) settings: Settings,
}

impl State {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        State {
            rooms: Mutex::new(HashMap::new()),
            connections: Mutex::new(HashMap::new()),
            transaction_queue: Mutex::new(TransactionQueue::new()),
            settings: Settings::new(config, jwks).await,
        }
    }
}
