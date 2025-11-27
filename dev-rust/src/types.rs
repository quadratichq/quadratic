use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Starting,
    Running,
    Error,
    Killed,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub name: String,
    pub status: ServiceStatus,
    pub watching: bool,
    pub hidden: bool,
    pub has_watch_command: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogMessage {
    pub service: String,
    pub message: String,
    pub timestamp: u64,
    #[serde(default = "default_stream")]
    pub stream: String, // "stdout" or "stderr"
}

fn default_stream() -> String {
    "stdout".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdate {
    pub services: Vec<ServiceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToggleRequest {
    pub service: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterRequest {
    pub service: String,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetWatchRequest {
    pub service: String,
    pub watching: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetStateRequest {
    pub watching: Option<std::collections::HashMap<String, bool>>,
    pub hidden: Option<std::collections::HashMap<String, bool>>,
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub name: String,
    pub color: String,
    pub dark_color: String,
    pub shortcut: String,
    pub port: Option<u16>,
    pub command: Vec<String>,
    pub watch_command: Option<Vec<String>>,
    pub cwd: Option<String>,
    pub success_patterns: Vec<String>,
    pub error_patterns: Vec<String>,
    pub start_patterns: Vec<String>,
}
