use axum::{
    extract::{ws::WebSocketUpgrade, Path, State},
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
use crate::types::{FilterRequest, LogMessage, ServiceInfo, SetPerfRequest, SetStateRequest, SetWatchRequest, StatusUpdate, ToggleRequest};

// Server startup time - changes when server restarts
static SERVER_START_TIME: std::sync::OnceLock<u64> = std::sync::OnceLock::new();

pub async fn start_server(control: Arc<RwLock<Control>>, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize server start time
    SERVER_START_TIME.get_or_init(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    });
    let app = Router::new()
        .route("/", get(index).head(index_head))
        .route("/ws", get(websocket_handler))
        .route("/api/status", get(get_status))
        .route("/api/logs", get(get_logs))
        .route("/api/toggle", post(toggle_watch))
        .route("/api/filter", post(toggle_filter))
        .route("/api/kill", post(kill_service))
        .route("/api/restart", post(restart_service))
        .route("/api/restart-all", post(restart_all_services))
        .route("/api/stop-all", post(stop_all_services))
        .route("/api/state", get(get_state).post(set_state))
        .route("/api/set-watch", post(set_watch))
        .route("/api/set-perf", post(set_perf))
        .route("/api/static-hash", get(get_static_hash).head(get_static_hash_head))
        .route("/api/server-version", get(get_server_version).head(get_server_version_head))
        .route("/*path", get(serve_static_file).head(serve_static_file_head))
        .layer(CorsLayer::permissive())
        .with_state(control);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    println!("Quadratic Dev server running on http://localhost:{}", port);
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

fn get_static_files_hash() -> axum::http::HeaderValue {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    // Hash all static files (HTML, CSS, and JavaScript)
    let mut hasher = DefaultHasher::new();
    include_str!("../static/index.html").hash(&mut hasher);
    include_str!("../static/styles.css").hash(&mut hasher);
    include_str!("../static/state.js").hash(&mut hasher);
    include_str!("../static/utils.js").hash(&mut hasher);
    include_str!("../static/websocket.js").hash(&mut hasher);
    include_str!("../static/services.js").hash(&mut hasher);
    include_str!("../static/logs.js").hash(&mut hasher);
    include_str!("../static/api.js").hash(&mut hasher);
    include_str!("../static/ui.js").hash(&mut hasher);

    let etag = format!("\"{}\"", hasher.finish());
    axum::http::HeaderValue::from_str(&etag).unwrap_or_else(|_| axum::http::HeaderValue::from_static("\"0\""))
}

async fn get_static_hash_head() -> impl IntoResponse {
    use axum::http::{HeaderMap, HeaderValue};

    let mut headers = HeaderMap::new();
    headers.insert(header::ETAG, get_static_files_hash());
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"));
    headers
}

async fn get_static_hash() -> impl IntoResponse {
    use axum::http::HeaderValue;

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(header::ETAG, get_static_files_hash());
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"));

    (headers, "ok")
}

fn get_server_version_hash() -> axum::http::HeaderValue {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();

    // Hash server start time - changes when server restarts
    if let Some(start_time) = SERVER_START_TIME.get() {
        start_time.hash(&mut hasher);
    }

    // Also hash static files to catch static file changes
    include_str!("../static/index.html").hash(&mut hasher);
    include_str!("../static/styles.css").hash(&mut hasher);
    include_str!("../static/state.js").hash(&mut hasher);
    include_str!("../static/utils.js").hash(&mut hasher);
    include_str!("../static/websocket.js").hash(&mut hasher);
    include_str!("../static/services.js").hash(&mut hasher);
    include_str!("../static/logs.js").hash(&mut hasher);
    include_str!("../static/api.js").hash(&mut hasher);
    include_str!("../static/ui.js").hash(&mut hasher);

    let etag = format!("\"{}\"", hasher.finish());
    axum::http::HeaderValue::from_str(&etag).unwrap_or_else(|_| axum::http::HeaderValue::from_static("\"0\""))
}

async fn get_server_version_head() -> impl IntoResponse {
    use axum::http::{HeaderMap, HeaderValue};

    let mut headers = HeaderMap::new();
    headers.insert(header::ETAG, get_server_version_hash());
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"));
    (StatusCode::OK, headers).into_response()
}

async fn get_server_version() -> impl IntoResponse {
    use axum::http::HeaderValue;

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(header::ETAG, get_server_version_hash());
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"));

    (StatusCode::OK, headers, "ok").into_response()
}

fn get_static_file(path: &str) -> Option<(&'static str, &'static str)> {
    // Map file paths to (content, content_type)
    match path {
        "styles.css" => Some((include_str!("../static/styles.css"), "text/css")),
        "state.js" => Some((include_str!("../static/state.js"), "application/javascript")),
        "utils.js" => Some((include_str!("../static/utils.js"), "application/javascript")),
        "websocket.js" => Some((include_str!("../static/websocket.js"), "application/javascript")),
        "services.js" => Some((include_str!("../static/services.js"), "application/javascript")),
        "logs.js" => Some((include_str!("../static/logs.js"), "application/javascript")),
        "api.js" => Some((include_str!("../static/api.js"), "application/javascript")),
        "ui.js" => Some((include_str!("../static/ui.js"), "application/javascript")),
        _ => None,
    }
}

fn get_file_etag(path: &str) -> Option<axum::http::HeaderValue> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    get_static_file(path).map(|(content, _)| {
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        let etag = format!("\"{}\"", hasher.finish());
        axum::http::HeaderValue::from_str(&etag).unwrap_or_else(|_| axum::http::HeaderValue::from_static("\"0\""))
    })
}

async fn serve_static_file_head(Path(path): Path<String>) -> impl IntoResponse {
    use axum::http::{HeaderMap, HeaderValue};

    if let Some((_, content_type)) = get_static_file(&path) {
        let mut headers = HeaderMap::new();
        if let Some(etag) = get_file_etag(&path) {
            headers.insert(header::ETAG, etag);
        }
        headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
        (StatusCode::OK, headers).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

async fn serve_static_file(Path(path): Path<String>) -> impl IntoResponse {
    use axum::http::HeaderValue;

    if let Some((content, content_type)) = get_static_file(&path) {
        let mut headers = axum::http::HeaderMap::new();
        if let Some(etag) = get_file_etag(&path) {
            headers.insert(header::ETAG, etag);
        }
        headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
        (StatusCode::OK, headers, content).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(control): State<Arc<RwLock<Control>>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, control))
}

async fn handle_socket(socket: axum::extract::ws::WebSocket, control: Arc<RwLock<Control>>) {
    let (mut sender, mut receiver) = socket.split();
    let (log_receiver, hidden_arc) = {
        let ctrl = control.read().await;
        (ctrl.get_log_sender().subscribe(), ctrl.get_hidden_arc())
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
    let hidden_for_logs = hidden_arc.clone();
    let tx_logs = tx.clone();
    tokio::spawn(async move {
        while let Ok((service, message, timestamp, stream)) = log_receiver_clone.recv().await {
            let hidden = hidden_for_logs.read().await;
            if hidden.get(&service).copied().unwrap_or(false) {
                continue;
            }
            drop(hidden);

            let log_msg = LogMessage {
                service,
                message,
                timestamp,
                stream,
            };

            if let Ok(json) = serde_json::to_string(&log_msg) {
                let _ = tx_logs.send(axum::extract::ws::Message::Text(json));
            }
        }
    });

    // Spawn task to send status updates
    let (status_arc, watching_arc, hidden_for_status, perf_arc) = {
        let ctrl = control.read().await;
        let service_manager = ctrl.get_service_manager();
        (
            service_manager.get_status(),
            service_manager.get_watching(),
            ctrl.get_hidden_arc(),
            ctrl.get_perf_arc(),
        )
    };
    let tx_status = tx.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(500));
        loop {
            interval.tick().await;

            let status = status_arc.read().await.clone();
            let watching = watching_arc.read().await.clone();
            let hidden = hidden_for_status.read().await.clone();
            let perf = *perf_arc.read().await;

            let services: Vec<ServiceInfo> = status
                .iter()
                .map(|(name, status)| {
                    let service_config = crate::services::get_service_by_name(name)
                        .map(|s| s.config());
                    let has_watch_command = service_config.as_ref()
                        .map(|c| c.watch_command.is_some())
                        .unwrap_or(false);
                    let has_perf_command = service_config.as_ref()
                        .map(|c| c.perf_command.is_some())
                        .unwrap_or(false);

                    ServiceInfo {
                        name: name.clone(),
                        status: status.clone(),
                        watching: *watching.get(name).unwrap_or(&false),
                        hidden: *hidden.get(name).unwrap_or(&false),
                        has_watch_command,
                        perf: if name == "core" { perf } else { false },
                        has_perf_command,
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
        .map(|(service, message, timestamp, stream)| LogMessage {
            service,
            message,
            timestamp,
            stream,
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
    let perf = {
        let ctrl = control.read().await;
        ctrl.get_perf().await
    };

    let services: Vec<ServiceInfo> = status
        .iter()
        .map(|(name, status)| {
            let service_config = crate::services::get_service_by_name(name)
                .map(|s| s.config());
            let has_watch_command = service_config.as_ref()
                .map(|c| c.watch_command.is_some())
                .unwrap_or(false);
            let has_perf_command = service_config.as_ref()
                .map(|c| c.perf_command.is_some())
                .unwrap_or(false);

            ServiceInfo {
                name: name.clone(),
                status: status.clone(),
                watching: *watching.get(name).unwrap_or(&false),
                hidden: *hidden.get(name).unwrap_or(&false),
                has_watch_command,
                perf: if name == "core" { perf } else { false },
                has_perf_command,
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
    let perf = {
        let ctrl = control.read().await;
        ctrl.get_perf().await
    };
    let theme = {
        let ctrl = control.read().await;
        ctrl.get_theme().await
    };

    let state = SetStateRequest {
        watching: Some(watching),
        hidden: Some(hidden),
        theme,
        perf: Some(perf),
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

async fn set_perf(
    State(control): State<Arc<RwLock<Control>>>,
    Json(req): Json<SetPerfRequest>,
) -> impl IntoResponse {
    let ctrl = control.read().await;
    ctrl.set_perf(req.perf).await;
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

async fn restart_all_services(
    State(control): State<Arc<RwLock<Control>>>,
) -> impl IntoResponse {
    let ctrl = control.write().await;
    ctrl.restart_all_services().await;

    (StatusCode::OK, Json(json!({"success": true})))
}

async fn stop_all_services(
    State(control): State<Arc<RwLock<Control>>>,
) -> impl IntoResponse {
    let ctrl = control.read().await;
    ctrl.stop_all_services().await;

    (StatusCode::OK, Json(json!({"success": true})))
}
