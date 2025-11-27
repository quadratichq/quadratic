use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct SharedService;

impl Service for SharedService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "shared".to_string(),
            color: "gray".to_string(),
            dark_color: "gray".to_string(),
            shortcut: "s".to_string(),
            port: None,
            command: vec![
                "npm".to_string(),
                "run".to_string(),
                "compile".to_string(),
                "--workspace=quadratic-shared".to_string(),
            ],
            watch_command: Some(vec![
                "npm".to_string(),
                "run".to_string(),
                "watch".to_string(),
                "--workspace=quadratic-shared".to_string(),
            ]),
            cwd: None,
            success_patterns: vec![" 0 errors.".to_string(), "successfully".to_string()],
            error_patterns: vec!["error".to_string()],
            start_patterns: vec!["Starting".to_string()],
        }
    }
}
