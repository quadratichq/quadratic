use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum MessageRequest {
    NewRoom { name: String },
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum MessageResponse {
    Room { name: String },
}

pub fn handle_message(request: MessageRequest) -> MessageResponse {
    match request {
        MessageRequest::NewRoom { name } => {
            tracing::info!("Handling message {name}");
            MessageResponse::Room {
                name: "test".into(),
            }
        }
    }
}
