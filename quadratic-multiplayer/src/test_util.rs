use fake::faker::filesystem::en::FilePath;
use fake::faker::name::en::{FirstName, LastName};
use fake::Fake;
use futures::stream::StreamExt;
use futures_util::SinkExt;
use std::sync::Arc;
use std::{
    future::IntoFuture,
    net::{Ipv4Addr, SocketAddr},
};
use tokio_tungstenite::tungstenite;
use uuid::Uuid;

use crate::message::request::MessageRequest;
use crate::state::user::{User, UserState};
use crate::state::State;

pub(crate) fn new_user() -> User {
    User {
        session_id: Uuid::new_v4(),
        user_id: Uuid::new_v4().to_string(),
        first_name: FirstName().fake(),
        last_name: LastName().fake(),
        state: UserState {
            sheet_id: Uuid::new_v4(),
            selection: "".to_string(),
            cell_edit: Default::default(),
            x: 0.0,
            y: 0.0,
            visible: false,
        },
        image: FilePath().fake(),
        socket: None,
        last_heartbeat: chrono::Utc::now(),
    }
}

pub(crate) async fn add_user_to_room(
    file_id: Uuid,
    user: User,
    state: Arc<State>,
    socket_id: Uuid,
) -> User {
    state.enter_room(file_id, &user, socket_id).await;
    user
}

pub(crate) async fn add_new_user_to_room(
    file_id: Uuid,
    state: Arc<State>,
    socket_id: Uuid,
) -> User {
    add_user_to_room(file_id, new_user(), state, socket_id).await
}

pub(crate) async fn integration_test(state: Arc<State>, request: MessageRequest) -> String {
    let listener = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, 0)))
        .await
        .unwrap();
    let addr = listener.local_addr().unwrap();

    // run the server in a separate thread
    tokio::spawn(axum::serve(listener, crate::server::app(state)).into_future());

    let (mut socket, _response) = tokio_tungstenite::connect_async(format!("ws://{addr}/ws"))
        .await
        .unwrap();

    // send the message
    socket
        .send(tungstenite::Message::text(
            serde_json::to_string(&request).unwrap(),
        ))
        .await
        .unwrap();

    match socket.next().await.unwrap().unwrap() {
        tungstenite::Message::Text(msg) => msg,
        other => panic!("expected a text message but got {other:?}"),
    }
}
