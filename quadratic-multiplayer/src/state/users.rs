use axum::extract::ws::{Message, WebSocket};
use chrono::{DateTime, Utc};
use futures_util::stream::SplitSink;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Serialize, Debug, Clone)]
pub struct User {
    pub session_id: Uuid,
    pub user_id: String,
    pub first_name: String,
    pub last_name: String,
    pub image: String,
    pub sheet_id: Option<Uuid>,
    pub selection: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    #[serde(skip_serializing)]
    pub socket: Option<Arc<Mutex<SplitSink<WebSocket, Message>>>>,
    #[serde(skip_serializing)]
    pub last_heartbeat: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct UserUpdate {
    pub sheet_id: Option<Uuid>,
    pub selection: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

impl PartialEq for User {
    fn eq(&self, other: &Self) -> bool {
        self.session_id == other.session_id

            // todo: is this needed, or can we assume if session_id is equal, then the object is equal for most purposes
            && self.user_id == other.user_id
            && self.first_name == other.first_name
            && self.last_name == other.last_name
            && self.image == other.image
    }
}
