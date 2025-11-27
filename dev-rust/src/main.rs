mod checks;
mod control;
mod server;
mod services;
mod types;

use control::Control;
use server::start_server;
use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let control = Arc::new(RwLock::new(Control::new()));

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
    let port = 8080; // Default port
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
