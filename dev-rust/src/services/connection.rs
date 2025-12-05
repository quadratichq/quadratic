use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct ConnectionService;

impl Service for ConnectionService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "connection".to_string(),
            color: "blue".to_string(),
            dark_color: "blue".to_string(),
            shortcut: "n".to_string(),
            port: Some(3003),
            command: vec!["cargo".to_string(), "run".to_string(), "-p".to_string(), "quadratic-connection".to_string(), "--target-dir=target".to_string()],
            watch_command: Some(vec![
                "cargo".to_string(),
                "watch".to_string(),
                "-x".to_string(),
                "run -p quadratic-connection --target-dir=target".to_string(),
            ]),
            perf_command: None,
            perf_watch_command: None,
            cwd: Some("quadratic-connection".to_string()),
            success_patterns: vec!["listening on".to_string()],
            error_patterns: vec![
                "error[".to_string(),
                "error:".to_string(),
                "failed to compile".to_string(),
                "npm ERR!".to_string(),
                "Compiling failed".to_string(),
                "Exit status: 1".to_string(),
            ],
            start_patterns: vec!["    Compiling".to_string()],
        }
    }
}
