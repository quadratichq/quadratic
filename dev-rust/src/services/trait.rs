use crate::types::ServiceConfig;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::process::Command;
use std::process::Stdio;

pub trait Service: Send + Sync {
    fn config(&self) -> ServiceConfig;

    fn name(&self) -> String {
        self.config().name
    }

    fn port(&self) -> Option<u16> {
        self.config().port
    }

    fn should_kill_port(&self) -> bool {
        self.port().is_some()
    }

    fn build_command(&self, watching: bool) -> Command {
        let config = self.config();
        let command = if watching {
            config.watch_command.as_ref().unwrap_or(&config.command)
        } else {
            &config.command
        };

        let mut cmd = Command::new(&command[0]);
        cmd.args(&command[1..]);

        if let Some(cwd) = &config.cwd {
            cmd.current_dir(cwd);
        }

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.env("RUST_LOG", "info");

        cmd
    }

    fn check_success(&self, line: &str) -> bool {
        self.config().success_patterns.iter().any(|p| line.contains(p))
    }

    fn check_error(&self, line: &str) -> bool {
        self.config().error_patterns.iter().any(|p| line.contains(p))
    }

    fn check_start(&self, line: &str) -> bool {
        self.config().start_patterns.iter().any(|p| line.contains(p))
    }
}
