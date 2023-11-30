use std::sync::Arc;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::State;

#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
pub enum MessageRequest {
    NewRoom { user_id: Uuid, file_id: Uuid },
    MouseMove { user_id: Uuid, x: f64, y: f64 },
}

#[derive(Serialize, Debug)]
#[serde(tag = "type")]
pub enum MessageResponse {
    Room { name: String },
    MouseMove { user_id: Uuid, x: f64, y: f64 },
}

pub fn handle_message(request: MessageRequest, state: Arc<State>) -> MessageResponse {
    tracing::trace!("Handling message {:?}", request);

    match request {
        MessageRequest::NewRoom { user_id, file_id } => MessageResponse::Room {
            name: format!("room-{}", user_id),
        },
        MessageRequest::MouseMove { user_id, x, y } => MessageResponse::MouseMove { user_id, x, y },
    }
}
