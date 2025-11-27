use crate::types::ServiceConfig;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

/// Find the project root by looking for the workspace Cargo.toml file
/// This handles the case where dev-rust is run from the dev-rust directory
fn find_project_root() -> Option<PathBuf> {
    let mut current = match std::env::current_dir() {
        Ok(dir) => dir,
        Err(_) => return None,
    };

    // If we're in dev-rust directory, go up one level first
    if current
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s == "dev-rust")
        .unwrap_or(false)
    {
        if let Some(parent) = current.parent() {
            current = parent.to_path_buf();
        }
    }

    loop {
        // Check if this directory contains a Cargo.toml with [workspace]
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists() {
            if let Ok(contents) = std::fs::read_to_string(&cargo_toml) {
                if contents.contains("[workspace]") {
                    return Some(current);
                }
            }
        }

        // Go up one directory
        match current.parent() {
            Some(parent) => current = parent.to_path_buf(),
            None => break,
        }
    }

    None
}

pub trait Service: Send + Sync {
    fn config(&self) -> ServiceConfig;

    fn port(&self) -> Option<u16> {
        self.config().port
    }

    fn build_command(&self, watching: bool) -> Command {
        let config = self.config();
        let command = if watching {
            config.watch_command.as_ref().unwrap_or(&config.command)
        } else {
            &config.command
        };

        // For npm commands, use shell execution to ensure PATH and npm scripts work correctly
        // For cargo watch commands with complex arguments, also use shell
        let use_shell = command[0] == "npm"
            || (command[0] == "cargo" && command.len() > 1 && command[1] == "watch");

        let mut cmd = if use_shell {
            // Use shell to execute the command (allows PATH resolution and shell features)
            #[cfg(target_os = "windows")]
            {
                let mut c = Command::new("cmd");
                c.arg("/C");

                // Build the full command, including cd if cwd is set
                let mut full_cmd = String::new();
                if let Some(cwd) = &config.cwd {
                    // Resolve the cwd path relative to the project root
                    let resolved_cwd = find_project_root()
                        .unwrap_or_else(|| {
                            std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                        })
                        .join(cwd)
                        .canonicalize()
                        .unwrap_or_else(|_| {
                            find_project_root()
                                .unwrap_or_else(|| {
                                    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                                })
                                .join(cwd)
                        });
                    let escaped_cwd = resolved_cwd.to_string_lossy().replace('"', "\"\"");
                    full_cmd.push_str(&format!("cd /d \"{}\" && ", escaped_cwd));
                }

                // Join command and args into a single string for shell execution
                let cmd_str = command
                    .iter()
                    .map(|s| {
                        // Quote arguments that contain spaces
                        if s.contains(' ') {
                            format!("\"{}\"", s)
                        } else {
                            s.clone()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ");
                full_cmd.push_str(&cmd_str);

                c.arg(&full_cmd);
                c
            }
            #[cfg(not(target_os = "windows"))]
            {
                let mut c = Command::new("sh");
                c.arg("-c");

                // Build the full command, including cd if cwd is set
                let mut full_cmd = String::new();

                // For npm commands without a cwd, ensure we run from project root
                // This helps npm resolve workspace dependencies and local node_modules
                // Also ensure cargo watch commands run from project root
                if (command[0] == "npm"
                    || (command[0] == "cargo" && command.len() > 1 && command[1] == "watch"))
                    && config.cwd.is_none()
                {
                    // Get the project root directory
                    if let Some(project_root) = find_project_root() {
                        let escaped_dir = project_root.to_string_lossy().replace('\'', "'\\''");
                        full_cmd.push_str(&format!("cd '{}' && ", escaped_dir));
                    } else if let Ok(current_dir) = std::env::current_dir() {
                        let escaped_dir = current_dir.to_string_lossy().replace('\'', "'\\''");
                        full_cmd.push_str(&format!("cd '{}' && ", escaped_dir));
                    }
                } else if let Some(cwd) = &config.cwd {
                    // Resolve the cwd path relative to the project root
                    // This ensures the path works regardless of where the shell is executed from
                    let resolved_cwd = find_project_root()
                        .unwrap_or_else(|| {
                            std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                        })
                        .join(cwd)
                        .canonicalize()
                        .unwrap_or_else(|_| {
                            find_project_root()
                                .unwrap_or_else(|| {
                                    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                                })
                                .join(cwd)
                        });
                    let escaped_cwd = resolved_cwd.to_string_lossy().replace('\'', "'\\''");
                    full_cmd.push_str(&format!("cd '{}' && ", escaped_cwd));
                }

                // Join command and args, properly quoting arguments with spaces
                let cmd_str = command
                    .iter()
                    .map(|s| {
                        // Quote arguments that contain spaces or special characters
                        if s.contains(' ') || s.contains('&') || s.contains('|') {
                            format!("'{}'", s.replace('\'', "'\\''"))
                        } else {
                            s.clone()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ");
                full_cmd.push_str(&cmd_str);

                c.arg(&full_cmd);
                c
            }
        } else {
            // Direct execution for simple commands like cargo run
            let mut c = Command::new(&command[0]);
            c.args(&command[1..]);
            if let Some(cwd) = &config.cwd {
                // Resolve the cwd path relative to the project root
                let resolved_cwd = find_project_root()
                    .unwrap_or_else(|| {
                        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                    })
                    .join(cwd)
                    .canonicalize()
                    .unwrap_or_else(|_| {
                        find_project_root()
                            .unwrap_or_else(|| {
                                std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                            })
                            .join(cwd)
                    });
                c.current_dir(resolved_cwd);
            }
            c
        };

        // Inherit the full environment from the parent process
        // This ensures PATH, NODE_PATH, and other environment variables are available
        cmd.env_clear();
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }

        // For npm and cargo watch commands, ensure we're running from the project root
        // This helps npm resolve workspace dependencies and local node_modules
        // Cargo watch needs to run from workspace root to find the Cargo.toml
        if (command[0] == "npm"
            || (command[0] == "cargo" && command.len() > 1 && command[1] == "watch"))
            && config.cwd.is_none()
        {
            // Get the project root directory
            if let Some(project_root) = find_project_root() {
                cmd.current_dir(&project_root);
            } else if let Ok(current_dir) = std::env::current_dir() {
                cmd.current_dir(&current_dir);
            }
        }

        // Set npm configuration to prefer local packages and avoid prompts
        if command[0] == "npm" {
            // Set npm_config_yes to prevent npx from prompting to install packages
            cmd.env("npm_config_yes", "true");
            // Ensure npm uses local node_modules
            cmd.env("npm_config_prefer_offline", "true");
        }

        // Set RUST_LOG
        cmd.env("RUST_LOG", "info");

        // For cargo watch, ensure output is not buffered and all output is shown
        if command[0] == "cargo" && command.len() > 1 && command[1] == "watch" {
            // Ensure cargo watch shows all output (don't use --quiet flag)
            cmd.env("RUST_BACKTRACE", "1");
            // Set environment to ensure unbuffered output
            cmd.env("PYTHONUNBUFFERED", "1");
        }

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        cmd
    }
}
