use axum::{
    extract::{ws::WebSocketUpgrade, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures::SinkExt;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

use crate::control::Control;
use crate::types::{FilterRequest, LogMessage, ServiceInfo, SetStateRequest, SetWatchRequest, StatusUpdate, ToggleRequest};

pub async fn start_server(control: Arc<RwLock<Control>>, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new()
        .route("/", get(index).head(index_head))
        .route("/ws", get(websocket_handler))
        .route("/api/status", get(get_status))
        .route("/api/logs", get(get_logs))
        .route("/api/toggle", post(toggle_watch))
        .route("/api/filter", post(toggle_filter))
        .route("/api/kill", post(kill_service))
        .route("/api/restart", post(restart_service))
        .route("/api/state", get(get_state).post(set_state))
        .route("/api/set-watch", post(set_watch))
        .route("/styles.css", get(serve_css))
        .route("/state.js", get(serve_state_js))
        .route("/utils.js", get(serve_utils_js))
        .route("/websocket.js", get(serve_websocket_js))
        .route("/services.js", get(serve_services_js))
        .route("/logs.js", get(serve_logs_js))
        .route("/api.js", get(serve_api_js))
        .route("/ui.js", get(serve_ui_js))
        .layer(CorsLayer::permissive())
        .with_state(control);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    println!("Dev server running on http://localhost:{}", port);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn index() -> Html<&'static str> {
    Html(include_str!("../static/index.html"))
}

async fn index_head() -> impl IntoResponse {
    use axum::http::{HeaderMap, HeaderValue};
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut headers = HeaderMap::new();
    // Use ETag based on file content hash for reliable change detection
    let html_content = include_str!("../static/index.html");
    let mut hasher = DefaultHasher::new();
    html_content.hash(&mut hasher);
    let etag = format!("\"{}\"", hasher.finish());

    if let Ok(header_value) = HeaderValue::from_str(&etag) {
        headers.insert(header::ETAG, header_value);
    }
    headers
}

async fn serve_css() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/css")],
        include_str!("../static/styles.css"),
    )
}

async fn serve_state_js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        include_str!("../static/state.js"),
    )
}

async fn serve_utils_js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        include_str!("../static/utils.js"),
    )
}

async fn serve_websocket_js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        include_str!("../static/websocket.js"),
    )
}

async fn serve_services_js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        include_str!("../static/services.js"),
    )
}

async fn serve_logs_js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        include_str!("../static/logs.js"),
    )
}

async fn serve_api_js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        include_str!("../static/api.js"),
    )
}

async fn serve_ui_js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        include_str!("../static/ui.js"),
    )
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(control): State<Arc<RwLock<Control>>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, control))
}

async fn handle_socket(socket: axum::extract::ws::WebSocket, control: Arc<RwLock<Control>>) {
    let (mut sender, mut receiver) = socket.split();
    let log_receiver = {
        let ctrl = control.read().await;
        ctrl.get_log_sender().subscribe()
    };

    // Channel for sending messages to the websocket
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<axum::extract::ws::Message>();

    // Task to forward messages from channel to websocket
    let sender_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Spawn task to send logs
    let mut log_receiver_clone = log_receiver;
    let control_logs = control.clone();
    let tx_logs = tx.clone();
    tokio::spawn(async move {
        while let Ok((service, message, timestamp)) = log_receiver_clone.recv().await {
            let hidden = {
                let ctrl = control_logs.read().await;
                ctrl.get_hidden().await
            };

            if hidden.get(&service).copied().unwrap_or(false) {
                continue;
            }

            let log_msg = LogMessage {
                service,
                message,
                timestamp,
            };

            if let Ok(json) = serde_json::to_string(&log_msg) {
                let _ = tx_logs.send(axum::extract::ws::Message::Text(json));
            }
        }
    });

    // Spawn task to send status updates
    let control_status = control.clone();
    let tx_status = tx.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(500));
        loop {
            interval.tick().await;

            let status = {
                let ctrl = control_status.read().await;
                ctrl.get_status().await
            };
            let watching = {
                let ctrl = control_status.read().await;
                ctrl.get_watching().await
            };
            let hidden = {
                let ctrl = control_status.read().await;
                ctrl.get_hidden().await
            };

            let services: Vec<ServiceInfo> = status
                .iter()
                .map(|(name, status)| {
                    let has_watch_command = crate::services::get_service_by_name(name)
                        .map(|s| s.config().watch_command.is_some())
                        .unwrap_or(false);

                    ServiceInfo {
                        name: name.clone(),
                        status: status.clone(),
                        watching: *watching.get(name).unwrap_or(&false),
                        hidden: *hidden.get(name).unwrap_or(&false),
                        has_watch_command,
                    }
                })
                .collect();

            let update = StatusUpdate { services };

            if let Ok(json) = serde_json::to_string(&update) {
                let _ = tx_status.send(axum::extract::ws::Message::Text(format!("status:{}", json)));
            }
        }
    });

    // Handle incoming messages (currently just keep connection alive)
    use futures::StreamExt;
    while let Some(msg) = receiver.next().await {
        if let Ok(msg) = msg {
            if matches!(msg, axum::extract::ws::Message::Close(_)) {
                break;
            }
        }
    }

    // Close the sender task
    let _ = tx.send(axum::extract::ws::Message::Close(None));
    let _ = sender_task.await;
}

async fn get_logs(
    State(control): State<Arc<RwLock<Control>>>,
) -> Result<Json<Vec<LogMessage>>, StatusCode> {
    let logs = {
        let ctrl = control.read().await;
        ctrl.get_logs().await
    };

    let log_messages: Vec<LogMessage> = logs
        .into_iter()
        .map(|(service, message, timestamp)| LogMessage {
            service,
            message,
            timestamp,
        })
        .collect();

    Ok(Json(log_messages))
}

async fn get_status(State(control): State<Arc<RwLock<Control>>>) -> impl IntoResponse {
    let status = {
        let ctrl = control.read().await;
        ctrl.get_status().await
    };
    let watching = {
        let ctrl = control.read().await;
        ctrl.get_watching().await
    };
    let hidden = {
        let ctrl = control.read().await;
        ctrl.get_hidden().await
    };

    let services: Vec<ServiceInfo> = status
        .iter()
        .map(|(name, status)| {
            let has_watch_command = crate::services::get_service_by_name(name)
                .map(|s| s.config().watch_command.is_some())
                .unwrap_or(false);

            ServiceInfo {
                name: name.clone(),
                status: status.clone(),
                watching: *watching.get(name).unwrap_or(&false),
                hidden: *hidden.get(name).unwrap_or(&false),
                has_watch_command,
            }
        })
        .collect();

    Json(StatusUpdate { services })
}

async fn toggle_watch(
    State(control): State<Arc<RwLock<Control>>>,
    Json(req): Json<ToggleRequest>,
) -> impl IntoResponse {
    let ctrl = control.read().await;
    ctrl.toggle_watch(&req.service).await;
    (StatusCode::OK, Json(json!({"success": true})))
}

async fn toggle_filter(
    State(control): State<Arc<RwLock<Control>>>,
    Json(req): Json<FilterRequest>,
) -> impl IntoResponse {
    let ctrl = control.read().await;
    ctrl.set_hidden(&req.service, req.hidden).await;
    (StatusCode::OK, Json(json!({"success": true})))
}

async fn kill_service(
    State(control): State<Arc<RwLock<Control>>>,
    Json(req): Json<ToggleRequest>,
) -> impl IntoResponse {
    let ctrl = control.read().await;
    ctrl.kill_service_toggle(&req.service).await;
    (StatusCode::OK, Json(json!({"success": true})))
}

async fn get_state(State(control): State<Arc<RwLock<Control>>>) -> impl IntoResponse {
    let watching = {
        let ctrl = control.read().await;
        ctrl.get_watching().await
    };
    let hidden = {
        let ctrl = control.read().await;
        ctrl.get_hidden().await
    };

    // Load theme from state file
    let mut theme = None;
    let state_file = std::path::Path::new("state.json");
    if state_file.exists() {
        if let Ok(content) = std::fs::read_to_string(state_file) {
            if let Ok(existing_state) = serde_json::from_str::<SetStateRequest>(&content) {
                theme = existing_state.theme;
            }
        }
    }

    let state = SetStateRequest {
        watching: Some(watching),
        hidden: Some(hidden),
        theme,
    };

    Json(state)
}

async fn set_state(
    State(control): State<Arc<RwLock<Control>>>,
    Json(req): Json<SetStateRequest>,
) -> impl IntoResponse {
    let ctrl = control.write().await;

    if let Some(watching) = req.watching {
        for (service, should_watch) in watching {
            ctrl.set_watch(&service, should_watch).await;
        }
    }

    if let Some(hidden) = req.hidden {
        for (service, should_hide) in hidden {
            ctrl.set_hidden(&service, should_hide).await;
        }
    }

    // Save theme if provided
    if let Some(theme) = req.theme {
        let _ = ctrl.save_state_with_theme(Some(theme)).await;
    } else {
        let _ = ctrl.save_state().await;
    }

    (StatusCode::OK, Json(json!({"success": true})))
}

async fn set_watch(
    State(control): State<Arc<RwLock<Control>>>,
    Json(req): Json<SetWatchRequest>,
) -> impl IntoResponse {
    let ctrl = control.read().await;
    ctrl.set_watch(&req.service, req.watching).await;
    (StatusCode::OK, Json(json!({"success": true})))
}

async fn restart_service(
    State(control): State<Arc<RwLock<Control>>>,
    Json(req): Json<ToggleRequest>,
) -> impl IntoResponse {
    // Check if shared is watching - if so, do nothing
    if req.service == "shared" {
        let watching = {
            let ctrl = control.read().await;
            ctrl.get_watching().await
        };
        if *watching.get("shared").unwrap_or(&false) {
            return (StatusCode::OK, Json(json!({"success": true, "message": "Shared is in watch mode, skipping restart"})));
        }
    }

    // Restart the service
    let ctrl = control.write().await;
    ctrl.restart_service(&req.service).await;

    (StatusCode::OK, Json(json!({"success": true})))
}
