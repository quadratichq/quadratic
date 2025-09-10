//! Websocket Message Handler
//!
//! A central place for handling websocket messages.  This module is
//! responsible for incoming requests and outgoing responses.

use quadratic_rust_shared::net::websocket_server::pre_connection::PreConnection;
use quadratic_rust_shared::protobuf::quadratic::transaction::{
    ShutdownCoreCloudAck, StartupCoreCloudAck, TransactionAck,
};
use uuid::Uuid;

use crate::error::Result;
use crate::message::{request::MessageRequest, response::MessageResponse};

/// Handle incoming messages.  All requests and responses are strictly typed.
#[tracing::instrument(level = "trace")]
pub(crate) async fn handle_message(
    request: MessageRequest,
    pre_connection: PreConnection,
) -> Result<Option<MessageResponse>> {
    println!("request: {:?}", request);

    match request {
        MessageRequest::StartupCoreCloud(request) => {
            let file_id = Uuid::parse_str(&request.file_id)?;

            let response = StartupCoreCloudAck {
                r#type: "StartupCoreCloudAck".to_string(),
                file_id: request.file_id,
            };

            Ok(Some(MessageResponse::StartupCoreCloudAck(response)))
        }
        MessageRequest::SendTransaction(request) => {
            let response = TransactionAck {
                r#type: "TransactionAck".to_string(),
                id: request.id,
                session_id: request.session_id,
                file_id: request.file_id,
                operations: request.operations,
            };
            Ok(Some(MessageResponse::TransactionAck(response)))
        }
        MessageRequest::ShutdownCoreCloud(request) => {
            let response = ShutdownCoreCloudAck {
                r#type: "ShutdownCoreCloudAck".to_string(),
                file_id: request.file_id,
            };
            Ok(Some(MessageResponse::ShutdownCoreCloudAck(response)))
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use quadratic_rust_shared::{
        net::websocket_server::pre_connection::PreConnection,
        protobuf::quadratic::transaction::{
            SendTransaction, ShutdownCoreCloud, ShutdownCoreCloudAck, StartupCoreCloud,
            StartupCoreCloudAck, TransactionAck,
        },
    };
    use uuid::Uuid;

    use super::*;

    #[tokio::test]
    async fn test_handle() {
        let file_id = Uuid::new_v4();
        let request = StartupCoreCloud {
            r#type: "StartupCoreCloud".to_string(),
            file_id: file_id.to_string(),
        };
        let pre_connection = PreConnection::new(None, None);

        let request = MessageRequest::StartupCoreCloud(request);
        let response = handle_message(request, pre_connection)
            .await
            .unwrap()
            .unwrap();
        let expected = MessageResponse::StartupCoreCloudAck(StartupCoreCloudAck {
            r#type: "StartupCoreCloudAck".to_string(),
            file_id: file_id.to_string(),
        });
        assert_eq!(response, expected);
    }
}
