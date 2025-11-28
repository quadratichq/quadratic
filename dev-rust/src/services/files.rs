use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct FilesService;

impl Service for FilesService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "files".to_string(),
            color: "yellow".to_string(),
            dark_color: "yellow".to_string(),
            shortcut: "f".to_string(),
            port: Some(3002),
            command: vec![
                "cargo".to_string(),
                "run".to_string(),
                "-p".to_string(),
                "quadratic-files".to_string(),
                "--target-dir=target".to_string(),
            ],
            watch_command: Some(vec![
                "cargo".to_string(),
                "watch".to_string(),
                "--no-gitignore".to_string(),
                "-x".to_string(),
                "run -p quadratic-files --target-dir=target".to_string(),
            ]),
            perf_command: None,
            perf_watch_command: None,
            cwd: Some("quadratic-files".to_string()),
            success_patterns: vec!["listening on".to_string()],
            error_patterns: vec![
                "error[".to_string(),
                "npm ERR!".to_string(),
                "Exit status: 1".to_string(),
            ],
            start_patterns: vec!["    Compiling".to_string()],
        }
    }
}
