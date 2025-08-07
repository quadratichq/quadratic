use axum::http::Response;
use prost::Message;
use std::sync::Arc;
use uuid::Uuid;

use quadratic_core::controller::{operations::operation::Operation, transaction::Transaction};
use quadratic_rust_shared::{
    net::websocket::{WebSocketSender, Websocket, get_enter_room_message},
    protobuf::quadratic::transaction::BinaryTransaction as BinaryTransactionProto,
};

use crate::{error::Result, state::State};

/// Connect to the Multiplayer server
pub(crate) async fn connect(state: &Arc<State>) -> Result<(Websocket, Response<Option<Vec<u8>>>)> {
    let token = state.settings.m2m_auth_token.to_owned();
    let headers = vec![("authorization".into(), format!("Bearer {}", token))];
    let websocket = Websocket::connect_with_headers("ws://localhost:3001/ws", headers).await?;

    Ok(websocket)
}

/// Enter the room
pub(crate) async fn enter_room(
    websocket: &mut WebSocketSender,
    user_id: Uuid,
    file_id: Uuid,
    session_id: Uuid,
) -> Result<()> {
    let enter_room_message = get_enter_room_message(user_id, file_id, session_id);
    let serialized_message = serde_json::to_string(&enter_room_message)?;
    websocket.send_text(&serialized_message).await?;

    Ok(())
}

/// Send a transaction to the Multiplayer server
pub(crate) async fn send_transaction(
    websocket: &mut WebSocketSender,
    file_id: Uuid,
    session_id: Uuid,
    operations: Vec<Operation>,
) -> Result<Uuid> {
    let id = Uuid::new_v4();
    let compressed_ops = Transaction::serialize_and_compress(&operations).unwrap();
    let request = BinaryTransactionProto {
        r#type: "BinaryTransaction".to_string(),
        id: id.to_string(),
        file_id: file_id.to_string(),
        session_id: session_id.to_string(),
        operations: compressed_ops.clone(),
    };
    let protobuf_message = request.encode_to_vec();
    websocket.send_binary(&protobuf_message).await?;

    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use quadratic_core::cell_values::CellValues;
    use quadratic_core::{CellValue, SheetPos, grid::SheetId};
    use std::str::FromStr;
    use std::time::Duration;

    use crate::test_util::new_arc_state;

    #[tokio::test]
    async fn test_multiplayer() {
        let state = new_arc_state().await;
        let user_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let session_id = Uuid::new_v4();

        let (websocket, response) = connect(&state).await.unwrap();
        let (mut sender, mut receiver) = websocket.split();
        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);

        // listen for messages in a separate thread
        tokio::spawn(async move {
            while let Ok(message) = receiver.receive().await {
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
        let id = send_transaction(&mut sender, file_id, session_id, operations)
            .await
            .unwrap();

        println!("transaction id: {:?}", id);

        // wait 1 minute to show presence in the demo
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}
