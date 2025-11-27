use crate::services::service::Service;
use crate::types::ServiceConfig;

pub struct TypesService;

impl Service for TypesService {
    fn config(&self) -> ServiceConfig {
        ServiceConfig {
            name: "types".to_string(),
            color: "magenta".to_string(),
            dark_color: "cyan".to_string(),
            shortcut: "t".to_string(),
            port: None,
            command: vec!["npm".to_string(), "run".to_string(), "build:wasm:types".to_string()],
            watch_command: None,
            cwd: None,
            success_patterns: vec!["Types exported successfully".to_string(), "Running ".to_string()],
            error_patterns: vec!["error:".to_string()],
            start_patterns: vec!["Compiling".to_string(), "> quadratic".to_string()],
        }
    }
}
