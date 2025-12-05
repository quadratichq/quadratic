use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct ApiService;

impl Service for ApiService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "api".to_string(),
            color: "blue".to_string(),
            dark_color: "white".to_string(),
            shortcut: "a".to_string(),
            port: Some(8000),
            command: vec![
                "npm".to_string(),
                "run".to_string(),
                "start-no-watch".to_string(),
                "--workspace=quadratic-api".to_string(),
            ],
            watch_command: Some(vec![
                "npm".to_string(),
                "run".to_string(),
                "start".to_string(),
                "--workspace=quadratic-api".to_string(),
            ]),
            perf_command: None,
            perf_watch_command: None,
            cwd: None,
            success_patterns: vec!["Server running".to_string()],
            error_patterns: vec!["\"level\":\"error\"".to_string()],
            start_patterns: vec!["> quadratic-api".to_string()],
        }
    }
}
