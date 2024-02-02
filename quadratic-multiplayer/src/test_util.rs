use fake::faker::filesystem::en::FilePath;
use fake::faker::internet::en::FreeEmail;
use fake::faker::name::en::{FirstName, LastName};
use fake::Fake;
use futures::stream::StreamExt;
use futures_util::SinkExt;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_core::controller::GridController;
use quadratic_core::{Array, CellValue, SheetRect};
use quadratic_rust_shared::quadratic_api::FilePermRole;
use std::sync::Arc;
use std::{
    future::IntoFuture,
    net::{Ipv4Addr, SocketAddr},
};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::{tungstenite, MaybeTlsStream, WebSocketStream};
use uuid::Uuid;

use crate::config::config;
use crate::message::request::MessageRequest;
use crate::state::connection::PreConnection;
use crate::state::user::{User, UserState};
use crate::state::State;

pub(crate) const TOKEN: &str = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjFaNTdkX2k3VEU2S1RZNTdwS3pEeSJ9.eyJpc3MiOiJodHRwczovL2Rldi1kdXp5YXlrNC5ldS5hdXRoMC5jb20vIiwic3ViIjoiNDNxbW44c281R3VFU0U1N0Fkb3BhN09jYTZXeVNidmRAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vZGV2LWR1enlheWs0LmV1LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNjIzNTg1MzAxLCJleHAiOjE2MjM2NzE3MDEsImF6cCI6IjQzcW1uOHNvNUd1RVNFNTdBZG9wYTdPY2E2V3lTYnZkIiwic2NvcGUiOiJyZWFkOnVzZXJzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.0MpewU1GgvRqn4F8fK_-Eu70cUgWA5JJrdbJhkCPCxXP-8WwfI-qx1ZQg2a7nbjXICYAEl-Z6z4opgy-H5fn35wGP0wywDqZpqL35IPqx6d0wRvpPMjJM75zVXuIjk7cEhDr2kaf1LOY9auWUwGzPiDB_wM-R0uvUMeRPMfrHaVN73xhAuQWVjCRBHvNscYS5-i6qBQKDMsql87dwR72DgHzMlaC8NnaGREBC-xiSamesqhKPVyGzSkFSaF3ZKpGrSDapqmHkNW9RDBE3GQ9OHM33vzUdVKOjU1g9Leb9PDt0o1U4p3NQoGJPShQ6zgWSUEaqvUZTfkbpD_DoYDRxA";

pub(crate) async fn new_state() -> State {
    let config = config().unwrap();
    State::new(&config, None).await
}

pub(crate) async fn new_arc_state() -> Arc<State> {
    Arc::new(new_state().await)
}

pub(crate) fn new_user() -> User {
    User {
        session_id: Uuid::new_v4(),
        user_id: Uuid::new_v4().to_string(),
        connection_id: Uuid::new_v4(),
        first_name: FirstName().fake(),
        last_name: LastName().fake(),
        email: FreeEmail().fake(),
        state: UserState {
            sheet_id: Uuid::new_v4(),
            selection: "".to_string(),
            cell_edit: Default::default(),
            x: 0.0,
            y: 0.0,
            visible: false,
            viewport: "initial viewport".to_string(),
            code_running: "".to_string(),
        },
        image: FilePath().fake(),
        permissions: vec![FilePermRole::FileEdit, FilePermRole::FileView],
        socket: None,
        last_heartbeat: chrono::Utc::now(),
    }
}

pub(crate) async fn add_user_to_room(file_id: Uuid, user: User, state: Arc<State>) -> User {
    let connection = PreConnection::new(None);
    state
        .enter_room(file_id, &user, connection, 0)
        .await
        .unwrap();
    user
}

pub(crate) async fn add_new_user_to_room(file_id: Uuid, state: Arc<State>) -> User {
    add_user_to_room(file_id, new_user(), state).await
}

pub(crate) fn operation(grid: &mut GridController, x: i64, y: i64, value: &str) -> Operation {
    let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
    let sheet_rect = SheetRect::single_pos((x, y).into(), sheet_id);
    let value = CellValue::Text(value.into());
    let values = Array::from(value);

    Operation::SetCellValues { sheet_rect, values }
}

pub(crate) async fn integration_test_setup(
    state: Arc<State>,
) -> WebSocketStream<MaybeTlsStream<TcpStream>> {
    let listener = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, 0)))
        .await
        .unwrap();
    let addr = listener.local_addr().unwrap();

    // run the server in a separate thread
    tokio::spawn(axum::serve(listener, crate::server::app(state)).into_future());

    let (socket, _response) = tokio_tungstenite::connect_async(format!("ws://{addr}/ws"))
        .await
        .unwrap();

    socket
}

pub(crate) async fn integration_test_send_and_receive(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    request: MessageRequest,
    expect_response: bool,
    response_num: usize,
) -> Option<String> {
    // send the message
    integration_test_send(socket, request).await;

    if !expect_response {
        return None;
    }

    integration_test_receive(socket, response_num).await
}

pub(crate) async fn integration_test_send(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    request: MessageRequest,
) {
    // send the message
    if let Err(e) = socket
        .lock()
        .await
        .send(tungstenite::Message::text(
            serde_json::to_string(&request).unwrap(),
        ))
        .await
    {
        println!("Error sending message: {:?}", e);
    };
}

pub(crate) async fn integration_test_receive(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    response_num: usize,
) -> Option<String> {
    let mut last_response = None;
    let mut count = 0;

    while let Some(Ok(msg)) = socket.lock().await.next().await {
        count += 1;
        last_response = match msg {
            tungstenite::Message::Text(msg) => Some(msg),
            other => panic!("expected a text message but got {other:?}"),
        };

        if count >= response_num {
            break;
        }
    }

    last_response
}
