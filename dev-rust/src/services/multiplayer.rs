use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct MultiplayerService;

impl Service for MultiplayerService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "multiplayer".to_string(),
            color: "green".to_string(),
            dark_color: "green".to_string(),
            shortcut: "m".to_string(),
            port: Some(3001),
            command: vec!["cargo".to_string(), "run".to_string(), "-p".to_string(), "quadratic-multiplayer".to_string(), "--target-dir=target".to_string()],
            watch_command: Some(vec![
                "cargo".to_string(),
                "watch".to_string(),
                "-x".to_string(),
                "run -p quadratic-multiplayer --target-dir=target".to_string(),
            ]),
            perf_command: None,
            perf_watch_command: None,
            cwd: Some("quadratic-multiplayer".to_string()),
            success_patterns: vec!["listening on".to_string()],
            error_patterns: vec!["error[".to_string(), "Exit status: 1".to_string()],
            start_patterns: vec!["    Compiling".to_string()],
        }
    }
}
