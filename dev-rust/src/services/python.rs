use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct PythonService;

impl Service for PythonService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "python".to_string(),
            color: "blueBright".to_string(),
            dark_color: "blueBright".to_string(),
            shortcut: "y".to_string(),
            port: None,
            command: vec![
                "npm".to_string(),
                "run".to_string(),
                "build:python".to_string(),
            ],
            watch_command: Some(vec![
                "npm".to_string(),
                "run".to_string(),
                "watch:python".to_string(),
            ]),
            cwd: None,
            success_patterns: vec!["Python complete".to_string()],
            error_patterns: vec!["Python error!".to_string()],
            start_patterns: vec![
                "quadratic-kernels/python-wasm/".to_string(),
                "Building package".to_string(),
            ],
        }
    }
}
