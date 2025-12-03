use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct CoreService;

impl Service for CoreService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "core".to_string(),
            color: "cyan".to_string(),
            dark_color: "cyan".to_string(),
            shortcut: "c".to_string(),
            port: None,
            command: vec![
                "npm".to_string(),
                "run".to_string(),
                "build:wasm:javascript".to_string(),
            ],
            watch_command: Some(vec![
                "npm".to_string(),
                "run".to_string(),
                "watch:wasm:javascript".to_string(),
            ]),
            perf_command: Some(vec![
                "npm".to_string(),
                "run".to_string(),
                "build:wasm:perf:javascript".to_string(),
            ]),
            perf_watch_command: Some(vec![
                "npm".to_string(),
                "run".to_string(),
                "watch:wasm:perf:javascript".to_string(),
            ]),
            cwd: None,
            success_patterns: vec![
                "[Finished running. Exit status: 0".to_string(),
                "ready to publish".to_string(),
            ],
            error_patterns: vec![
                "error[".to_string(),
                "error:".to_string(),
                "failed to compile".to_string(),
                "Exit status: 1".to_string(),
                "npm ERR!".to_string(),
            ],
            start_patterns: vec!["> quadratic".to_string(), "[Running ".to_string()],
        }
    }
}
