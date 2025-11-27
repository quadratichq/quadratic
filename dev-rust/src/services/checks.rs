use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct ChecksService;

impl Service for ChecksService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "checks".to_string(),
            color: "blue".to_string(),
            dark_color: "blue".to_string(),
            shortcut: "x".to_string(),
            port: None,
            command: vec!["echo".to_string(), "checks".to_string()],
            watch_command: None,
            perf_command: None,
            perf_watch_command: None,
            cwd: None,
            success_patterns: vec!["✓".to_string(), "OK".to_string(), "running".to_string()],
            error_patterns: vec![
                "✗".to_string(),
                "not running".to_string(),
                "ERROR".to_string(),
            ],
            start_patterns: vec!["Checking".to_string()],
        }
    }
}
