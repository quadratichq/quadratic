use crate::types::ServiceStatus;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::process::Command;
use tokio::sync::broadcast;
use tokio::sync::RwLock;

pub struct Checks {
    log_sender: broadcast::Sender<(String, String, u64, String)>,
    status: Arc<RwLock<HashMap<String, ServiceStatus>>>,
    status_change_sender: broadcast::Sender<()>,
}

/// Find the project root by looking for the workspace Cargo.toml or package.json file
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

impl Checks {
    pub fn new(
        log_sender: broadcast::Sender<(String, String, u64, String)>,
        status: Arc<RwLock<HashMap<String, ServiceStatus>>>,
        status_change_sender: broadcast::Sender<()>,
    ) -> Self {
        Self { log_sender, status, status_change_sender }
    }

    pub async fn run(&self) {
        self.log("checks", "Checking services...".to_string()).await;

        // Update status to starting
        {
            let mut status = self.status.write().await;
            status.insert("checks".to_string(), ServiceStatus::Starting);
        }
        self.notify_status_change();

        // Check Redis
        let redis_running = self.check_redis().await;
        if redis_running {
            self.log("checks", "✓ Redis is running".to_string()).await;
        } else {
            self.log_with_stream("checks", "✗ Redis is NOT running".to_string(), "stderr").await;
        }

        // Check PostgreSQL
        let postgres_running = self.check_postgres().await;
        if postgres_running {
            self.log("checks", "✓ PostgreSQL is running".to_string()).await;
        } else {
            self.log_with_stream("checks", "✗ PostgreSQL is NOT running".to_string(), "stderr").await;
        }

        // Check database connection (try to connect to postgres)
        if postgres_running {
            // Try a simple database query to verify connection
            let db_check = Command::new("psql")
                .arg("-U")
                .arg("postgres")
                .arg("-d")
                .arg("postgres")
                .arg("-c")
                .arg("SELECT 1;")
                .output()
                .await;

            let db_connected = match db_check {
                Ok(output) if output.status.success() => true,
                _ => {
                    // If local check failed, try Docker
                    let docker_db_check = Command::new("docker")
                        .arg("exec")
                        .arg("postgres")
                        .arg("psql")
                        .arg("-U")
                        .arg("postgres")
                        .arg("-d")
                        .arg("postgres")
                        .arg("-c")
                        .arg("SELECT 1;")
                        .output()
                        .await;

                    match docker_db_check {
                        Ok(output) if output.status.success() => true,
                        Ok(_) => {
                            self.log_with_stream("checks", "✗ Database connection FAILED".to_string(), "stderr").await;
                            false
                        }
                        Err(_) => {
                            self.log_with_stream("checks", "✗ Database connection check skipped (psql not found)".to_string(), "stderr").await;
                            false
                        }
                    }
                }
            };

            if db_connected {
                self.log("checks", "✓ Database connection OK".to_string()).await;
            }
        } else {
            self.log_with_stream("checks", "✗ Database connection FAILED (PostgreSQL not running)".to_string(), "stderr").await;
        }

        // Check database migrations
        if postgres_running {
            let migrations_ok = self.check_migrations().await;
            if migrations_ok {
                self.log("checks", "✓ Database migrations OK".to_string()).await;
            } else {
                self.log_with_stream("checks", "✗ Database migrations FAILED".to_string(), "stderr").await;
            }
        } else {
            self.log_with_stream("checks", "✗ Database migrations check skipped (PostgreSQL not running)".to_string(), "stderr").await;
        }

        // Update status based on results
        let all_ok = redis_running && postgres_running;
        {
            let mut status = self.status.write().await;
            if all_ok {
                status.insert("checks".to_string(), ServiceStatus::Running);
            } else {
                status.insert("checks".to_string(), ServiceStatus::Error);
            }
        }
        self.notify_status_change();

        self.log("checks", "Checks completed.".to_string()).await;
    }

    async fn check_redis(&self) -> bool {
        // Try local redis-cli first
        let output = Command::new("redis-cli")
            .arg("ping")
            .output()
            .await;

        match output {
            Ok(o) if o.status.success() => {
                // Verify we got PONG response
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.trim() == "PONG"
            }
            _ => {
                // If local check failed, try Docker
                let docker_output = Command::new("docker")
                    .arg("exec")
                    .arg("redis")
                    .arg("redis-cli")
                    .arg("ping")
                    .output()
                    .await;

                match docker_output {
                    Ok(o) if o.status.success() => {
                        // Verify we got PONG response
                        let stdout = String::from_utf8_lossy(&o.stdout);
                        stdout.trim() == "PONG"
                    }
                    Ok(o) => {
                        // Command failed - log the error for debugging
                        let stderr = String::from_utf8_lossy(&o.stderr);
                        let stdout = String::from_utf8_lossy(&o.stdout);
                        self.log_with_stream(
                            "checks",
                            format!("Redis check failed: status={}, stdout={:?}, stderr={:?}",
                                o.status.code().unwrap_or(-1), stdout, stderr),
                            "stderr"
                        ).await;
                        false
                    }
                    Err(e) => {
                        // Command not found or other error
                        self.log_with_stream(
                            "checks",
                            format!("Redis check error: {}", e),
                            "stderr"
                        ).await;
                        false
                    }
                }
            }
        }
    }

    async fn check_migrations(&self) -> bool {
        // Find project root
        let project_root = find_project_root()
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

        // Run npm run prisma:migrate --workspace=quadratic-api
        // This runs prisma migrate dev which checks if migrations are up to date
        let output = Command::new("npm")
            .arg("run")
            .arg("prisma:migrate")
            .arg("--workspace=quadratic-api")
            .current_dir(&project_root)
            .output()
            .await;

        match output {
            Ok(o) if o.status.success() => true,
            Ok(o) => {
                // Command failed - log the error for debugging
                let stderr = String::from_utf8_lossy(&o.stderr);
                let stdout = String::from_utf8_lossy(&o.stdout);
                self.log_with_stream(
                    "checks",
                    format!("Migration check failed: status={}, stdout={:?}, stderr={:?}",
                        o.status.code().unwrap_or(-1), stdout, stderr),
                    "stderr"
                ).await;
                false
            }
            Err(e) => {
                // Command not found or other error
                self.log_with_stream(
                    "checks",
                    format!("Migration check error: {}", e),
                    "stderr"
                ).await;
                false
            }
        }
    }

    async fn check_postgres(&self) -> bool {
        // Try local pg_isready first
        let output = Command::new("pg_isready")
            .output()
            .await;

        match output {
            Ok(o) if o.status.success() => true,
            _ => {
                // If local check failed, try Docker
                let docker_output = Command::new("docker")
                    .arg("exec")
                    .arg("postgres")
                    .arg("pg_isready")
                    .output()
                    .await;

                match docker_output {
                    Ok(o) if o.status.success() => true,
                    Ok(o) => {
                        // Command failed - log the error for debugging
                        let stderr = String::from_utf8_lossy(&o.stderr);
                        let stdout = String::from_utf8_lossy(&o.stdout);
                        self.log_with_stream(
                            "checks",
                            format!("PostgreSQL check failed: status={}, stdout={:?}, stderr={:?}",
                                o.status.code().unwrap_or(-1), stdout, stderr),
                            "stderr"
                        ).await;
                        false
                    }
                    Err(e) => {
                        // Command not found or other error
                        self.log_with_stream(
                            "checks",
                            format!("PostgreSQL check error: {}", e),
                            "stderr"
                        ).await;
                        false
                    }
                }
            }
        }
    }

    async fn log(&self, service: &str, message: String) {
        self.log_with_stream(service, message, "stdout").await;
    }

    async fn log_with_stream(&self, service: &str, message: String, stream: &str) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = self.log_sender.send((service.to_string(), message, timestamp, stream.to_string()));
    }

    fn notify_status_change(&self) {
        // Ignore send errors - it's ok if no one is listening
        let _ = self.status_change_sender.send(());
    }
}
