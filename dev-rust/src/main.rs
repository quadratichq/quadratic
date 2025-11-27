mod checks;
mod control;
mod server;
mod services;
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

/// Find the workspace root by looking for Cargo.toml with [workspace] or package.json
fn find_workspace_root() -> Option<PathBuf> {
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
        // Check if this directory contains a Cargo.toml with [workspace] or package.json
        let cargo_toml = current.join("Cargo.toml");
        let package_json = current.join("package.json");

        if cargo_toml.exists() {
            if let Ok(contents) = std::fs::read_to_string(&cargo_toml) {
                if contents.contains("[workspace]") {
                    return Some(current);
                }
            }
        }

        if package_json.exists() {
            // This is likely the project root (has package.json)
            return Some(current);
        }

        // Go up one directory
        match current.parent() {
            Some(parent) => current = parent.to_path_buf(),
            None => break,
        }
    }

    None
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();
    // If dir is the default "." and we can find the workspace root, use that instead
    let base_dir = if args.dir == PathBuf::from(".") {
        find_workspace_root()
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    } else {
        args.dir
    };

    // Always canonicalize to an absolute path to ensure consistency
    let base_dir = base_dir
        .canonicalize()
        .unwrap_or_else(|_| {
            // If canonicalize fails (e.g., path doesn't exist yet), try to make it absolute
            if base_dir.is_absolute() {
                base_dir
            } else {
                std::env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .join(base_dir)
            }
        });

    let control = Arc::new(RwLock::new(Control::new(base_dir)));

    // Start the control system
    {
        let control_clone = control.clone();
        tokio::spawn(async move {
            let mut ctrl = control_clone.write().await;
            ctrl.start().await;
        });
    }

    // Set up signal handler for graceful shutdown
    let control_for_server = control.clone();
    let control_for_cleanup = control.clone();
    let port = args.port;
    let server_handle = tokio::spawn(async move {
        if let Err(e) = start_server(control_for_server, port).await {
            eprintln!("Server error: {}", e);
        }
    });

    // Wait for either server to finish or a signal
    tokio::select! {
        _ = server_handle => {
            // Server finished (shouldn't normally happen)
        }
        _ = async {
            #[cfg(unix)]
            {
                use tokio::signal::unix::{signal, SignalKind};
                let mut sigterm = signal(SignalKind::terminate()).unwrap();
                let mut sigint = signal(SignalKind::interrupt()).unwrap();

                tokio::select! {
                    _ = sigterm.recv() => {
                        eprintln!("\nReceived SIGTERM, shutting down...");
                    }
                    _ = sigint.recv() => {
                        eprintln!("\nReceived SIGINT, shutting down...");
                    }
                }
            }
            #[cfg(windows)]
            {
                use tokio::signal::windows::ctrl_c;
                let mut ctrl_c = ctrl_c().unwrap();
                ctrl_c.recv().await;
                eprintln!("\nReceived Ctrl+C, shutting down...");
            }
        } => {
            // Kill all services before exiting
            let ctrl = control_for_cleanup.write().await;
            ctrl.kill_all_services().await;
        }
    }

    Ok(())
}
