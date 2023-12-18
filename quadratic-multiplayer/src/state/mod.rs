//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod connection;
pub mod room;
pub mod transaction_queue;
pub mod user;

use aws_sdk_s3::Client;
use jsonwebtoken::jwk::JwkSet;
use std::collections::HashMap;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::Config;
use crate::file::new_client;
use crate::state::room::Room;
use crate::state::transaction_queue::TransactionQueue;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) rooms: Mutex<HashMap<Uuid, Room>>,
    pub(crate) connections: Mutex<HashMap<Uuid, Uuid>>,
    pub(crate) transaction_queue: Mutex<TransactionQueue>,
    pub(crate) settings: Settings,
}

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) authenticate_jwt: bool,
    pub(crate) quadratic_api_uri: String,
    pub(crate) aws_client: Client,
}

impl Settings {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        Settings {
            jwks,
            authenticate_jwt: config.authenticate_jwt,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            aws_client: new_client(
                &config.aws_s3_access_key_id,
                &config.aws_s3_secret_access_key,
                &config.aws_s3_region,
            )
            .await,
        }
    }
}

impl State {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        // TODO(ddimaria): seed transaction_queue with the sequence_num from the database for each file
        State {
            rooms: Mutex::new(HashMap::new()),
            connections: Mutex::new(HashMap::new()),
            transaction_queue: Mutex::new(TransactionQueue::new()),
            settings: Settings::new(config, jwks).await,
        }
    }
}
