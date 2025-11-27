use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct ClientService;

impl Service for ClientService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "client".to_string(),
            color: "magenta".to_string(),
            dark_color: "cyan".to_string(),
            shortcut: "r".to_string(),
            port: Some(3000),
            command: vec![
                "npm".to_string(),
                "run".to_string(),
                "start:no-hmr".to_string(),
                "--workspace=quadratic-client".to_string(),
            ],
            watch_command: Some(vec![
                "npm".to_string(),
                "run".to_string(),
                "start".to_string(),
                "--workspace=quadratic-client".to_string(),
            ]),
            cwd: None,
            success_patterns: vec![
                "Found 0 error".to_string(),
                "Network: use --host to expose".to_string(),
                "Local:".to_string(),
                "preview server running".to_string(),
                "ready in".to_string(),
            ],
            error_patterns: vec!["ERROR(".to_string(), "npm ERR!".to_string()],
            start_patterns: vec!["> quadratic-client@".to_string()],
        }
    }
}
