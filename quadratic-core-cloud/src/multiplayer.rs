use http::Response;
use prost::Message;
use uuid::Uuid;

use quadratic_core::controller::{operations::operation::Operation, transaction::Transaction};
use quadratic_rust_shared::{
    multiplayer::message::request::MessageRequest,
    net::websocket_client::{
        WebSocketSender, WebsocketClient, get_enter_room_message, get_leave_room_message,
    },
    protobuf::quadratic::transaction::BinaryTransaction as BinaryTransactionProto,
};

use crate::error::Result;

/// Connect to the Multiplayer server
pub(crate) async fn connect(
    m2m_auth_token: &str,
) -> Result<(WebsocketClient, Response<Option<Vec<u8>>>)> {
    let headers = vec![("authorization".into(), format!("Bearer {}", m2m_auth_token))];
    let websocket =
        WebsocketClient::connect_with_headers("ws://localhost:3001/ws", headers).await?;

    Ok(websocket)
}

pub(crate) async fn send_message(
    websocket: &mut WebSocketSender,
    message: MessageRequest,
) -> Result<()> {
    let serialized_message = serde_json::to_string(&message)?;
    websocket.send_text(&serialized_message).await?;

    Ok(())
}

/// Enter the room
pub(crate) async fn enter_room(
    websocket: &mut WebSocketSender,
    user_id: Uuid,
    file_id: Uuid,
    session_id: Uuid,
) -> Result<()> {
    let enter_room_message = get_enter_room_message(user_id, file_id, session_id);
    send_message(websocket, enter_room_message).await
}

pub(crate) async fn get_transactions(
    websocket: &mut WebSocketSender,
    file_id: Uuid,
    session_id: Uuid,
    min_sequence_num: u64,
) -> Result<()> {
    let get_transactions_message = MessageRequest::GetBinaryTransactions {
        file_id,
        session_id,
        min_sequence_num,
    };

    send_message(websocket, get_transactions_message).await
}

/// Send a transaction to the Multiplayer server.
/// Returns the id of the transaction.
pub(crate) async fn send_transaction(
    websocket: &mut WebSocketSender,
    id: Uuid,
    file_id: Uuid,
    session_id: Uuid,
    operations: Vec<Operation>,
) -> Result<Uuid> {
    let compressed_ops = Transaction::serialize_and_compress(&operations).unwrap();
    let request = BinaryTransactionProto {
        r#type: "BinaryTransaction".to_string(),
        id: id.to_string(),
        file_id: file_id.to_string(),
        session_id: session_id.to_string(),
        operations: compressed_ops,
    };
    let protobuf_message = request.encode_to_vec();
    websocket.send_binary(&protobuf_message).await?;

    Ok(id)
}

/// Leave the room
pub(crate) async fn leave_room(
    websocket: &mut WebSocketSender,
    session_id: Uuid,
    file_id: Uuid,
) -> Result<()> {
    let leave_room_message = get_leave_room_message(session_id, file_id);
    send_message(websocket, leave_room_message).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use http::StatusCode;
    use quadratic_core::cell_values::CellValues;
    use quadratic_core::{CellValue, SheetPos, grid::SheetId};
    use std::str::FromStr;
    use std::time::Duration;

    #[tokio::test]
    async fn test_multiplayer() {
        let user_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let session_id = Uuid::new_v4();
        let m2m_auth_token = "M2M_AUTH_TOKEN".to_string();

        let (websocket, response) = connect(&m2m_auth_token).await.unwrap();
        let (mut sender, mut receiver) = websocket.split();
        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);

        // listen for messages in a separate thread
        tokio::spawn(async move {
            while let Ok(message) = receiver.receive_text().await {
                println!("message: {:?}", message);
            }
        });

        // enter the room
        enter_room(&mut sender, user_id, file_id, session_id)
            .await
            .unwrap();

        // send a binary transaction
        let sheet_id = SheetId::from_str("159f4b68-c02f-4dfb-954c-35000b7283a9").unwrap();
        let operations = vec![Operation::SetCellValues {
            sheet_pos: SheetPos::new(sheet_id, 1, 1),
            values: CellValues::from(vec![vec![CellValue::Text("hello world".to_string())]]),
        }];
        let transaction_id = Uuid::new_v4();
        let id = send_transaction(&mut sender, transaction_id, file_id, session_id, operations)
            .await
            .unwrap();

        println!("transaction id: {:?}", id);

        // wait 1 minute to show presence in the demo
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}
