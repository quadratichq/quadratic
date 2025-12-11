mod checks;
mod control;
mod server;
mod service_manager;
mod services;
mod target;
mod types;

use clap::Parser;
use control::Control;
use server::start_server;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Parser, Debug)]
#[command(name = "dev-rust")]
#[command(about = "Quadratic Dev Server")]
struct Args {
    /// Port to run the server on
    #[arg(long, default_value = "8080")]
    port: u16,

    /// Base directory for state and other files
    #[arg(long, default_value = ".")]
    dir: PathBuf,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    eprintln!("Starting Quadratic Dev Server...");

    let args = Args::parse();

    // Do blocking file I/O operations in parallel, but start server immediately
    // Quick initial base_dir - try to find workspace root quickly, fallback to current dir
    let initial_base_dir = if args.dir == PathBuf::from(".") {
        // Quick check: if we're in dev-rust, go up one level
        let current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        if current.file_name().and_then(|n| n.to_str()) == Some("dev-rust") {
            current.parent().unwrap_or(&current).to_path_buf()
        } else {
            // Quick check for workspace root in current dir or parent
            let check_workspace = |dir: &PathBuf| -> bool {
                dir.join("Cargo.toml").exists() && {
                    if let Ok(content) = std::fs::read_to_string(dir.join("Cargo.toml")) {
                        content.contains("[workspace]")
                    } else {
                        false
                    }
                }
            };

            if check_workspace(&current) {
                current
            } else if let Some(parent) = current.parent() {
                let parent = parent.to_path_buf();
                if check_workspace(&parent) {
                    parent
                } else {
                    current
                }
            } else {
                current
            }
        }
    } else {
        args.dir.clone()
    };

    // Canonicalize base_dir immediately to ensure consistent paths regardless of where we run from
    // This prevents cargo from using different target directories when run from different locations
    let initial_base_dir = initial_base_dir.canonicalize().unwrap_or(initial_base_dir);

    // Load state file before starting services
    let saved_state = {
        let state_file = initial_base_dir.join("dev-rust-state.json");
        tokio::task::spawn_blocking(move || {
            if state_file.exists() {
                if let Ok(content) = std::fs::read_to_string(&state_file) {
                    serde_json::from_str::<crate::types::SetStateRequest>(&content).ok()
                } else {
                    None
                }
            } else {
                None
            }
        })
        .await
        .ok()
        .flatten()
    };

    // Create Control with loaded state
    let control = Arc::new(RwLock::new(Control::new_with_state(
        initial_base_dir.clone(),
        saved_state,
    )));

    // Resolve base_dir properly in background (find workspace root + canonicalize)
    // This doesn't block server startup - we don't need to update Control since
    // it already works with initial_base_dir
    {
        let args_dir = args.dir.clone();
        tokio::spawn(async move {
            let resolved_dir = if args_dir == PathBuf::from(".") {
                tokio::task::spawn_blocking(|| {
                    let current_dir =
                        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                    crate::target::find_project_root(&current_dir).unwrap_or(current_dir)
                })
                .await
                .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
            } else {
                args_dir
            };

            // Canonicalize with timeout
            let base_dir_clone = resolved_dir.clone();
            let base_dir_fallback = resolved_dir.clone();
            let _resolved_base_dir = tokio::time::timeout(
                tokio::time::Duration::from_millis(500),
                tokio::task::spawn_blocking(move || {
                    base_dir_clone.canonicalize().unwrap_or_else(|_| {
                        if base_dir_clone.is_absolute() {
                            base_dir_clone
                        } else {
                            std::env::current_dir()
                                .unwrap_or_else(|_| PathBuf::from("."))
                                .join(base_dir_clone)
                        }
                    })
                }),
            )
            .await
            .unwrap_or_else(|_| {
                let fallback = base_dir_fallback.clone();
                Ok(if fallback.is_absolute() {
                    fallback
                } else {
                    std::env::current_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                        .join(fallback)
                })
            })
            .unwrap_or_else(|_| {
                if base_dir_fallback.is_absolute() {
                    base_dir_fallback
                } else {
                    std::env::current_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                        .join(base_dir_fallback)
                }
            });

            // Note: We could reload state here if needed, but for now
            // the initial state load from current_dir is sufficient
        });
    }

    // Start the control system
    {
        let control_clone = control.clone();
        tokio::spawn(async move {
            let ctrl = control_clone.read().await;
            ctrl.start().await;
        });
    }

    // Run the HTTP server and wait for either completion or a shutdown signal.
    let control_for_server = control.clone();
    let mut server_future = Box::pin(start_server(control_for_server, args.port));

    let shutdown_reason = tokio::select! {
        result = &mut server_future => {
            if let Err(e) = result {
                eprintln!("Server error: {}", e);
            }
            "server finished"
        }
        reason = wait_for_shutdown_signal() => {
            eprintln!("\nReceived {reason}, shutting down...");
            reason
        }
    };

    // Ensure all services are killed before exiting.
    {
        let ctrl = control.write().await;
        ctrl.kill_all_services().await;
    }

    if shutdown_reason != "server finished" {
        // If we exited due to a signal, ensure the server future is dropped so it stops serving.
        drop(server_future);
    }

    Ok(())
}

async fn wait_for_shutdown_signal() -> &'static str {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        let mut sigterm =
            signal(SignalKind::terminate()).expect("failed to install SIGTERM handler");
        let mut sigint = signal(SignalKind::interrupt()).expect("failed to install SIGINT handler");

        tokio::select! {
            _ = sigterm.recv() => "SIGTERM",
            _ = sigint.recv() => "SIGINT",
        }
    }

    #[cfg(not(unix))]
    {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
        "Ctrl+C"
    }
}
