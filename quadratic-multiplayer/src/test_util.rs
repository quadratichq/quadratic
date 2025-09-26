use axum::body::Body;
use axum::http::{self, Request, Response};
use fake::Fake;
use fake::faker::filesystem::en::FilePath;
use fake::faker::internet::en::FreeEmail;
use fake::faker::name::en::{FirstName, LastName};
use futures::stream::StreamExt;
use futures_util::SinkExt;
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage};
use quadratic_core::cell_values::CellValues;
use quadratic_core::controller::GridController;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_core::{CellValue, SheetPos};
use quadratic_rust_shared::quadratic_api::FilePermRole;
use std::sync::Arc;
use std::{
    future::IntoFuture,
    net::{Ipv4Addr, SocketAddr},
};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, tungstenite};
use tower::ServiceExt;
use uuid::Uuid;

use crate::config::config;
use crate::message::request::MessageRequest;
use crate::message::response::MessageResponse;
use crate::server::app;
use crate::state::State;
use crate::state::connection::PreConnection;
use crate::state::user::{CellEdit, User, UserState};

pub(crate) const TOKEN: &str = "eyJhbGciOiJSUzI1NiIsImtpZCI6InNzb19vaWRjX2tleV9wYWlyXzAxSlhXUjc4NlBGVjJUNkZBQU5NQ0tGOFRUIn0.eyJlbWFpbCI6ImF5dXNoQGdtYWlsLmNvbSIsImlzcyI6Imh0dHBzOi8vYXBpLndvcmtvcy5jb20vdXNlcl9tYW5hZ2VtZW50L2NsaWVudF8wMUpYV1I3OEcxUlM5NDNTSlpHOUc5S0ZEVyIsInN1YiI6InVzZXJfMDFLNEVaQzYzMUdHSEZLQjVWWEVBUlBCMEciLCJzaWQiOiJzZXNzaW9uXzAxSzRFWkM2UFlTRUI1SldTS0ZEWkZHV0RCIiwianRpIjoiMDFLNEVaQ0pZRjkxNzk3Rk1HMTUyRFc0OEgiLCJleHAiOjE3NTcxNDQ2MDQsImlhdCI6MTc1NzE0NDMwNH0.g22z76GKyuKctRZ4FPzWvEbNAOC1yEvnHCzSVRp7x58vfAo1X8qjXfI7sNNHHK6HsDMKjX6OOl74g1rjGTlSPc5kJYeoU6BLpB3Y_WamAe3YranIE5oxbhU37MJiOYoyHF9gZA08sJVH0T20rTDigPitlX3H1FpLMX_iQRAblLJalgrtgQgYpyKLc354n2k_YXcJD_6j8wVFn93DSJYeyQONSwl5BTftYDO-vvz0k3nIpQpPsgjzDy-SsNDkJFNHpcEFdIh2FQkQT2JDUjmIfhijYeMCy9VoSxCP17La6ErTvZh8gCeyEw2XRIktK3xt58BOxQvsVrtXXuoW0y9Kag";
pub static GROUP_NAME_TEST: &str = "quadratic-multiplayer-test-1";

/// General setup to be used for tests.  It creates:
/// - Global State
/// - A WebSocket for connecting to the server
/// - A Room (file_id)
/// - 2 Users (user_1, user_2) in the Room
/// - A Connection (connection_id) for the User
/// - A Subscription to the Room in PubSub
pub(crate) async fn setup() -> (
    Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    Arc<State>,
    Uuid,
    Uuid,
    User,
    User,
) {
    let file_id = Uuid::new_v4();
    let user_1 = new_user();
    let user_2 = new_user();

    setup_existing_room(file_id, user_1, user_2).await
}

/// General setup to be used for tests.  It creates:
/// - Global State
/// - A WebSocket for connecting to the server
/// - A Room (file_id)
/// - 2 Users (user_1, user_2) in the Room
/// - A Connection (connection_id) for the User
/// - A Subscription to the Room in PubSub
pub(crate) async fn setup_existing_room(
    file_id: Uuid,
    user_1: User,
    user_2: User,
) -> (
    Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    Arc<State>,
    Uuid,
    Uuid,
    User,
    User,
) {
    let state = new_arc_state().await;
    let socket = integration_test_setup(state.clone()).await;
    let socket = Arc::new(Mutex::new(socket));

    let filter = "quadratic_multiplayer=debug";
    let subscriber = tracing_subscriber::fmt().with_env_filter(filter).finish();
    let _ = tracing::subscriber::set_global_default(subscriber);

    state
        .subscribe_pubsub(&file_id, GROUP_NAME_TEST)
        .await
        .unwrap();

    let connection_id =
        new_connection(socket.clone(), state.clone(), file_id, user_1.clone()).await;

    // add another user so that we can test broadcasting
    new_connection(socket.clone(), state.clone(), file_id, user_2.clone()).await;

    (socket, state, connection_id, file_id, user_1, user_2)
}

/// Create new global state
pub(crate) async fn new_state() -> State {
    let config = config().unwrap();
    State::new(&config, None).await.unwrap()
}

/// Create new global state wrapped in an Arc
pub(crate) async fn new_arc_state() -> Arc<State> {
    Arc::new(new_state().await)
}

/// Create a new user with fake values
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
            follow: None,
        },
        image: FilePath().fake(),
        permissions: vec![FilePermRole::FileView, FilePermRole::FileEdit],
        socket: None,
        last_heartbeat: chrono::Utc::now(),
        index: 0,
    }
}

pub(crate) fn enter_room_request(file_id: Uuid, user: User) -> MessageRequest {
    MessageRequest::EnterRoom {
        session_id: user.session_id,
        user_id: user.user_id,
        file_id,
        sheet_id: user.state.sheet_id,
        selection: String::new(),
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        image: user.image,
        cell_edit: CellEdit::default(),
        viewport: "initial viewport".to_string(),
        follow: None,
    }
}

/// Add an existing to a room via the WebSocket.
/// Returns a reference to the user's `receiver` WebSocket.
pub(crate) async fn add_user_via_ws(
    file_id: Uuid,
    socket: Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    user: User,
) -> User {
    let request = enter_room_request(file_id, user.clone());

    // UsersInRoom and EnterRoom are sent to the client when they enter a room
    integration_test_send_and_receive(&socket, request, true, 1).await;
    integration_test_receive(&socket, 1).await;

    user
}

/// Add a new user to a room via global state directly.
/// Returns the user.
pub(crate) async fn add_new_user_to_room(file_id: Uuid, state: Arc<State>) -> User {
    add_user_to_room(file_id, new_user(), state).await
}

/// Add an existing user to a room via global state directly.
/// Returns the user.
pub(crate) async fn add_user_to_room(file_id: Uuid, user: User, state: Arc<State>) -> User {
    let connection = PreConnection::new(None, None);
    let mut user = user.clone();
    state
        .enter_room(file_id, &mut user, connection, 0)
        .await
        .unwrap();
    user
}

/// Add a new connection to global state directly.
/// Returns the id of the connection.
pub(crate) async fn new_connection(
    socket: Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    state: Arc<State>,
    file_id: Uuid,
    user: User,
) -> Uuid {
    add_user_via_ws(file_id, socket.clone(), user.clone()).await;

    state
        ._get_user_in_room(&file_id, &user.session_id)
        .await
        .unwrap()
        .connection_id
}

/// Create a new operation for testing
pub(crate) fn operation(grid: &mut GridController, x: i64, y: i64, value: &str) -> Operation {
    let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
    let sheet_pos = SheetPos { x, y, sheet_id };
    let value = CellValue::Text(value.into());
    let values = CellValues::from(value);

    Operation::SetCellValues { sheet_pos, values }
}

/// Setup integration testing, which:
/// - Runs the app in a separate thread
/// - Connects to the app via WebSocket
/// - Returns a reference to the user's `receiver` WebSocket
///
pub(crate) async fn integration_test_setup(
    state: Arc<State>,
) -> WebSocketStream<MaybeTlsStream<TcpStream>> {
    let listener = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, 0)))
        .await
        .unwrap();
    let addr = listener.local_addr().unwrap();

    // run the server in a separate thread
    tokio::spawn(
        axum::serve(
            listener,
            crate::server::app(state).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .into_future(),
    );

    let (socket, _response) = tokio_tungstenite::connect_async(format!("ws://{addr}/ws"))
        .await
        .unwrap();

    socket
}

/// Using the WebSocket created in integration_test_setup(), send a message
/// and receive a response.
/// `response_num` is the number of responses to receive before returning the last one.
/// Returns the optional response.
pub(crate) async fn integration_test_send_and_receive(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    request: MessageRequest,
    expect_response: bool,
    response_num: usize,
) -> Option<MessageResponse> {
    // send the message
    integration_test_send(socket, request).await;

    if !expect_response {
        return None;
    }

    integration_test_receive(socket, response_num).await
}

/// Using the WebSocket created in integration_test_setup(), send a message.
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
        println!("Error sending message: {e:?}");
    };
}

/// Using the WebSocket created in integration_test_setup(), receive a response.
/// Returns the optional response.
/// `response_num` is the number of responses to receive before returning the last one.
pub(crate) async fn integration_test_receive(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    response_num: usize,
) -> Option<MessageResponse> {
    let mut last_response = None;
    let mut count = 0;

    while let Some(Ok(msg)) = socket.lock().await.next().await {
        count += 1;
        last_response = match msg {
            tungstenite::Message::Text(msg) => {
                Some(serde_json::from_str::<MessageResponse>(&msg).unwrap())
            }
            tungstenite::Message::Binary(msg) => {
                let pool_bytes = quadratic_rust_shared::protobuf::FILE_DESCRIPTOR_SET;
                let pool = DescriptorPool::decode(pool_bytes).unwrap();

                // Try each message type in the pool
                for descriptor in pool.all_messages() {
                    if let Ok(_message) = DynamicMessage::decode(descriptor.clone(), &msg[..]) {
                        println!("Message name: {}", descriptor.full_name());
                        // println!("transaction: {:?}", message);

                        match descriptor.full_name() {
                            "quadratic.SendTransactions" => {
                                let decoded = quadratic_rust_shared::protobuf::quadratic::transaction::SendTransactions::decode(&msg[..]).unwrap();
                                println!("SendTransaction: {decoded:?}");
                                // });
                            }
                            "quadratic.SendGetTransactions" => {
                                let decoded = quadratic_rust_shared::protobuf::quadratic::transaction::SendGetTransactions::decode(&msg[..]).unwrap();
                                println!("SendGetTransactions: {decoded:?}");
                            }
                            "quadratic.ReceiveTransaction" => {
                                let decoded = quadratic_rust_shared::protobuf::quadratic::transaction::ReceiveTransaction::decode(&msg[..]).unwrap();
                                println!("ReceiveTransaction: {decoded:?}");
                            }
                            _ => println!("Unknown message type: {}", descriptor.full_name()),
                        }

                        break;
                    }
                }
                None
            }
            other => panic!("expected a text message but got {other:?}"),
        };

        if count >= response_num {
            break;
        }
    }

    last_response
}

/// Process a route and return the response.
/// TODO(ddimaria): move to quadratic-rust-shared
pub(crate) async fn process_route(uri: &str, method: http::Method, body: Body) -> Response<Body> {
    let state = new_arc_state().await;
    let app = app(state);

    app.oneshot(
        Request::builder()
            .method(method)
            .uri(uri)
            .body(body)
            .unwrap(),
    )
    .await
    .unwrap()
}
