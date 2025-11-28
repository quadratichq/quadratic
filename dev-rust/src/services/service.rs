use crate::types::ServiceConfig;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

#[cfg(unix)]
use nix::unistd;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(unix)]
use std::process::Command as StdCommand;

pub trait Service: Send + Sync {
    fn config(&self) -> ServiceConfig;

    fn port(&self) -> Option<u16> {
        self.config().port
    }

    fn build_command(&self, watching: bool, perf: bool, base_dir: &std::path::Path) -> Command {
        let config = self.config();
        let command = match (watching, perf) {
            (true, true) => config
                .perf_watch_command
                .as_ref()
                .or(config.watch_command.as_ref())
                .unwrap_or(&config.command),
            (true, false) => config.watch_command.as_ref().unwrap_or(&config.command),
            (false, true) => config.perf_command.as_ref().unwrap_or(&config.command),
            (false, false) => &config.command,
        };

        // Use a shell only for cargo watch commands, which rely on shell features.
        let use_shell = command[0] == "cargo" && command.len() > 1 && command[1] == "watch";

        let mut cmd = if use_shell {
            // Use shell to execute the command (allows PATH resolution and shell features)
            #[cfg(target_os = "windows")]
            {
                let mut c = Command::new("cmd");
                c.arg("/C");

                // Build the full command, including cd if cwd is set
                let mut full_cmd = String::new();
                if let Some(cwd) = &config.cwd {
                    // Resolve the cwd path relative to the base directory
                    // Use absolute path to avoid issues when running from different directories
                    let resolved_cwd = base_dir.join(cwd).canonicalize().unwrap_or_else(|_| {
                        // If canonicalize fails, at least make it absolute
                        if base_dir.is_absolute() {
                            base_dir.join(cwd)
                        } else {
                            std::env::current_dir()
                                .unwrap_or_else(|_| PathBuf::from("."))
                                .join(base_dir)
                                .join(cwd)
                        }
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
                // Use a shell wrapper that creates a new process group
                // On Linux: use setsid if available
                // On macOS: use a shell trick to create a new process group
                let mut c = Command::new("sh");
                c.arg("-c");

                // Build the full command, including cd if cwd is set
                let mut full_cmd = String::new();

                // For npm commands without a cwd, ensure we run from base directory
                // This helps npm resolve workspace dependencies and local node_modules
                // Also ensure cargo watch commands run from base directory
                // Use absolute path to avoid issues when running from different directories
                if (command[0] == "npm"
                    || (command[0] == "cargo" && command.len() > 1 && command[1] == "watch"))
                    && config.cwd.is_none()
                {
                    // Ensure we use an absolute path
                    let abs_base_dir = base_dir.canonicalize().unwrap_or_else(|_| {
                        if base_dir.is_absolute() {
                            base_dir.to_path_buf()
                        } else {
                            std::env::current_dir()
                                .unwrap_or_else(|_| PathBuf::from("."))
                                .join(base_dir)
                        }
                    });
                    let escaped_dir = abs_base_dir.to_string_lossy().replace('\'', "'\\''");
                    full_cmd.push_str(&format!("cd '{}' && ", escaped_dir));
                } else if let Some(cwd) = &config.cwd {
                    // Resolve the cwd path relative to the base directory
                    // This ensures the path works regardless of where the shell is executed from
                    // Use absolute path to avoid issues when running from different directories
                    let resolved_cwd = base_dir.join(cwd).canonicalize().unwrap_or_else(|_| {
                        // If canonicalize fails, at least make it absolute
                        if base_dir.is_absolute() {
                            base_dir.join(cwd)
                        } else {
                            std::env::current_dir()
                                .unwrap_or_else(|_| PathBuf::from("."))
                                .join(base_dir)
                                .join(cwd)
                        }
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
                // Use exec so the shell does not stay alive; this keeps the spawned PID stable.
                full_cmd.push_str("exec ");
                full_cmd.push_str(&cmd_str);

                c.arg(&full_cmd);
                c
            }
        } else {
            // Direct execution for simple commands like cargo run
            let mut c = Command::new(&command[0]);
            c.args(&command[1..]);
            if let Some(cwd) = &config.cwd {
                // Resolve the cwd path relative to the base directory
                // Use absolute path to avoid issues when running from different directories
                let resolved_cwd = base_dir.join(cwd).canonicalize().unwrap_or_else(|_| {
                    // If canonicalize fails, at least make it absolute
                    if base_dir.is_absolute() {
                        base_dir.join(cwd)
                    } else {
                        std::env::current_dir()
                            .unwrap_or_else(|_| PathBuf::from("."))
                            .join(base_dir)
                            .join(cwd)
                    }
                });
                c.current_dir(resolved_cwd);
            } else {
                // If no cwd specified, run from base_dir (workspace root)
                // This ensures cargo commands can find the workspace Cargo.toml
                let abs_base_dir = base_dir.canonicalize().unwrap_or_else(|_| {
                    if base_dir.is_absolute() {
                        base_dir.to_path_buf()
                    } else {
                        std::env::current_dir()
                            .unwrap_or_else(|_| PathBuf::from("."))
                            .join(base_dir)
                    }
                });
                c.current_dir(&abs_base_dir);
            }
            c
        };

        // Inherit the full environment from the parent process
        // This ensures PATH, NODE_PATH, and other environment variables are available
        cmd.env_clear();
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }

        // For npm and cargo watch commands, ensure we're running from the base directory
        // This helps npm resolve workspace dependencies and local node_modules
        // Cargo watch needs to run from workspace root to find the Cargo.toml
        // Use absolute path to avoid issues when running from different directories
        if (command[0] == "npm"
            || (command[0] == "cargo" && command.len() > 1 && command[1] == "watch"))
            && config.cwd.is_none()
        {
            // Ensure we use an absolute path
            let abs_base_dir = base_dir.canonicalize().unwrap_or_else(|_| {
                if base_dir.is_absolute() {
                    base_dir.to_path_buf()
                } else {
                    std::env::current_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                        .join(base_dir)
                }
            });
            cmd.current_dir(&abs_base_dir);
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

        // Create a new process group with this process as the leader.
        // This allows us to reliably kill the entire process tree using killpg.
        // The child's PID becomes its PGID, so we can use child.id() as the PGID for killing.
        #[cfg(unix)]
        {
            // Convert tokio::process::Command to std::process::Command to set pre_exec
            // We'll rebuild it as std::process::Command, set pre_exec, then convert back
            let std_cmd_ref = cmd.as_std();

            // Create a new std::process::Command with the same configuration
            let mut std_cmd = StdCommand::new(std_cmd_ref.get_program());
            for arg in std_cmd_ref.get_args() {
                std_cmd.arg(arg);
            }
            if let Some(cwd) = std_cmd_ref.get_current_dir() {
                std_cmd.current_dir(cwd);
            }
            for (key, value) in std_cmd_ref.get_envs() {
                match value {
                    Some(val) => {
                        std_cmd.env(key, val);
                    }
                    None => {
                        std_cmd.env_remove(key);
                    }
                }
            }
            std_cmd.stdout(Stdio::piped());
            std_cmd.stderr(Stdio::piped());

            // Set pre_exec to create a new process group
            unsafe {
                std_cmd.pre_exec(|| {
                    // setpgid(0, 0) sets the process group ID to our own PID,
                    // making this process the leader of a new process group.
                    // All child processes will inherit this PGID.
                    unistd::setpgid(unistd::Pid::from_raw(0), unistd::Pid::from_raw(0))
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                    Ok(())
                });
            }

            // Convert back to tokio::process::Command
            cmd = Command::from(std_cmd);
        }

        cmd
    }
}
