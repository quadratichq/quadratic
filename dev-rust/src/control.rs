use crate::checks::Checks;
use crate::types::ServiceStatus;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::broadcast;
use tokio::sync::RwLock;

pub struct Control {
    processes: Arc<RwLock<HashMap<String, Option<Child>>>>,
    status: Arc<RwLock<HashMap<String, ServiceStatus>>>,
    watching: Arc<RwLock<HashMap<String, bool>>>,
    hidden: Arc<RwLock<HashMap<String, bool>>>,
    log_sender: broadcast::Sender<(String, String, u64, String)>, // (service, message, timestamp, stream)
    logs: Arc<RwLock<Vec<(String, String, u64, String)>>>, // Store logs: (service, message, timestamp, stream)
    quitting: Arc<RwLock<bool>>,
    base_dir: std::path::PathBuf,
}

impl Control {
    pub fn new(base_dir: std::path::PathBuf) -> Self {
        let (log_sender, mut log_receiver) = broadcast::channel(1000);
        let logs = Arc::new(RwLock::new(Vec::new()));
        let logs_clone = logs.clone();

        // Spawn task to store all logs
        tokio::spawn(async move {
            while let Ok((service, message, timestamp, stream)) = log_receiver.recv().await {
                let mut logs_guard = logs_clone.write().await;
                logs_guard.push((service, message, timestamp, stream));
                // Keep only last 100000 logs to avoid memory issues
                if logs_guard.len() > 100000 {
                    logs_guard.drain(0..10000); // Remove oldest 10000
                }
            }
        });

        let mut status = HashMap::new();
        let mut watching = HashMap::new();
        let mut hidden = HashMap::new();

        // Load state from JSON file if it exists, otherwise use defaults
        let state_file = base_dir.join("state.json");
        let (saved_watching, saved_hidden, _saved_theme) = if state_file.exists() {
            if let Ok(content) = std::fs::read_to_string(state_file) {
                if let Ok(state) = serde_json::from_str::<crate::types::SetStateRequest>(&content) {
                    (
                        state.watching.unwrap_or_default(),
                        state.hidden.unwrap_or_default(),
                        state.theme,
                    )
                } else {
                    (HashMap::new(), HashMap::new(), None)
                }
            } else {
                (HashMap::new(), HashMap::new(), None)
            }
        } else {
            (HashMap::new(), HashMap::new(), None)
        };

        for service in crate::services::get_services() {
            status.insert(service.name.clone(), ServiceStatus::Stopped);
            // Use saved state if available, otherwise default to true (all services enabled)
            let should_watch = saved_watching.get(&service.name).copied().unwrap_or(true);
            watching.insert(service.name.clone(), should_watch);
            hidden.insert(
                service.name.clone(),
                saved_hidden.get(&service.name).copied().unwrap_or(false),
            );
        }

        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
            status: Arc::new(RwLock::new(status)),
            watching: Arc::new(RwLock::new(watching)),
            hidden: Arc::new(RwLock::new(hidden)),
            log_sender,
            logs,
            quitting: Arc::new(RwLock::new(false)),
            base_dir,
        }
    }

    pub fn get_log_sender(&self) -> broadcast::Sender<(String, String, u64, String)> {
        self.log_sender.clone()
    }

    pub async fn start(&mut self) {
        // Check services first
        self.check_services().await;

        // Start all services by default (unless explicitly disabled)
        // Start in a logical order: dependencies first

        // Start all services by default (in logical order: dependencies first)
        // Start types first (needed for core)
        self.start_service("types").await;

        // Start core (needed for client)
        self.start_service("core").await;

        // Start shared (needed for api)
        self.start_service("shared").await;

        // Start client
        self.start_service("client").await;

        // Start python
        self.start_service("python").await;

        // Start API (depends on shared)
        self.start_service("api").await;

        // Start Rust services
        self.start_service("multiplayer").await;
        self.start_service("files").await;
        self.start_service("connection").await;
    }

    async fn check_services(&self) {
        // Run checks and output to checks service
        self.run_checks().await;
    }

    async fn run_checks(&self) {
        let checks = Checks::new(self.log_sender.clone(), self.status.clone());
        checks.run().await;
    }

    pub async fn start_service(&self, name: &str) {
        if *self.quitting.read().await {
            return;
        }

        // Don't start services that are killed - they must be manually restarted
        {
            let status = self.status.read().await;
            if matches!(status.get(name), Some(ServiceStatus::Killed)) {
                return;
            }
        }

        // Handle checks service specially - run checks and exit
        if name == "checks" {
            let checks = Checks::new(self.log_sender.clone(), self.status.clone());
            checks.run().await;
            return;
        }

        let service = crate::services::get_service_by_name(name);
        let Some(service) = service else {
            return;
        };

        // Kill existing process
        self.kill_service(name).await;

        // Kill port if needed
        if let Some(port) = service.port() {
            self.kill_port(port).await;
        }

        let watching = *self.watching.read().await.get(name).unwrap_or(&false);
        let base_dir = self.base_dir.clone();
        let mut cmd = service.build_command(watching, &base_dir);


        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                self.log(name, format!("Failed to start: {}", e)).await;
                let mut status = self.status.write().await;
                status.insert(name.to_string(), ServiceStatus::Error);
                return;
            }
        };

        // Log that we've started the process (for debugging)
        self.log(name, format!("Process spawned successfully")).await;

        // Update status
        {
            let mut status = self.status.write().await;
            status.insert(name.to_string(), ServiceStatus::Starting);
        }

        self.log(name, format!("Starting...")).await;

        // Handle stdout
        let stdout = child.stdout.take();
        if let Some(stdout) = stdout {
            let name = name.to_string();
            let sender = self.log_sender.clone();
            let status = self.status.clone();
            let service_config = service.config();

            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                loop {
                    match lines.next_line().await {
                        Ok(Some(line)) => {
                            let timestamp = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            let _ = sender.send((name.clone(), line.clone(), timestamp, "stdout".to_string()));

                    // Check for success/error patterns using service methods
                    // Don't update status if service is killed
                    let mut status_guard = status.write().await;
                    let current_status = status_guard.get(&name).cloned().unwrap_or(ServiceStatus::Stopped);

                    // Don't change status if service is killed
                    if matches!(current_status, ServiceStatus::Killed) {
                        continue;
                    }

                    // Transition to appropriate state whenever pattern is detected, regardless of current state
                    if service_config.success_patterns.iter().any(|p| line.contains(p)) {
                        status_guard.insert(name.clone(), ServiceStatus::Running);
                    } else if service_config.error_patterns.iter().any(|p| line.contains(p)) {
                        status_guard.insert(name.clone(), ServiceStatus::Error);
                    } else if service_config.start_patterns.iter().any(|p| line.contains(p)) {
                        status_guard.insert(name.clone(), ServiceStatus::Starting);
                    }
                        }
                        Ok(None) => {
                            break;
                        }
                        Err(e) => {
                            eprintln!("Error reading stdout for {}: {}", name, e);
                            break;
                        }
                    }
                }
            });
        }

        // Handle stderr
        let stderr = child.stderr.take();
        if let Some(stderr) = stderr {
            let name = name.to_string();
            let sender = self.log_sender.clone();
            let status = self.status.clone();
            let service_config = service.config();

            // For cargo-based services (like core), stderr contains normal informational output
            // We'll check if it's an actual error, otherwise treat as stdout
            let is_cargo_service = name == "core" || name == "multiplayer" || name == "files" || name == "connection";
            let error_patterns = service_config.error_patterns.clone();

            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                loop {
                    match lines.next_line().await {
                        Ok(Some(line)) => {
                            let timestamp = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();

                            // Check if this line matches error patterns
                            let is_error = error_patterns.iter().any(|p| line.contains(p));

                            // For cargo-based services: if it's an error, mark as stderr; otherwise as stdout
                            // For other services: always mark as stderr
                            let stream = if is_cargo_service {
                                if is_error { "stderr" } else { "stdout" }
                            } else {
                                "stderr"
                            };

                            let _ = sender.send((name.clone(), line.clone(), timestamp, stream.to_string()));

                    // Check for error patterns to update status
                    // Don't update status if service is killed
                    if is_error {
                        let mut status_guard = status.write().await;
                        let current_status = status_guard.get(&name).cloned().unwrap_or(ServiceStatus::Stopped);
                        // Don't change status if service is killed
                        if !matches!(current_status, ServiceStatus::Killed) {
                            status_guard.insert(name.clone(), ServiceStatus::Error);
                        }
                    }
                        }
                        Ok(None) => {
                            break;
                        }
                        Err(e) => {
                            eprintln!("Error reading stderr for {}: {}", name, e);
                            break;
                        }
                    }
                }
            });
        }

        // Store process
        {
            let mut processes = self.processes.write().await;
            processes.insert(name.to_string(), Some(child));
        }
    }

    pub async fn kill_service(&self, name: &str) {
        // First, kill the port if the service has one (this kills child processes using the port)
        let service = crate::services::get_service_by_name(name);
        if let Some(service) = service {
            if let Some(port) = service.port() {
                self.kill_port(port).await;
            }
        }

        // Then kill the spawned process and its process group
        let mut processes = self.processes.write().await;
        if let Some(Some(mut child)) = processes.remove(name) {
            #[cfg(not(target_os = "windows"))]
            {
                // On Unix, kill the entire process group
                // When spawning through a shell, the shell is the process group leader
                // Killing with negative PID kills the entire process group (shell + npm + vite + all children)
                if let Some(pid) = child.id() {
                    // Kill the entire process group (negative PID)
                    let _ = Command::new("kill")
                        .args(&["-9", &format!("-{}", pid)])
                        .output()
                        .await;
                }
                // Also kill the direct process as fallback
                let _ = child.kill();
            }
            #[cfg(target_os = "windows")]
            {
                // On Windows, just kill the process
                let _ = child.kill();
            }
            let _ = child.wait();
        }
    }

    async fn kill_port(&self, port: u16) {
        #[cfg(not(target_os = "windows"))]
        {
            let output = Command::new("lsof")
                .args(&["-ti", &format!("tcp:{}", port)])
                .output()
                .await;

            if let Ok(output) = output {
                if !output.stdout.is_empty() {
                    let pid = String::from_utf8_lossy(&output.stdout);
                    let pid = pid.trim();
                    if !pid.is_empty() {
                        let _ = Command::new("kill")
                            .args(&["-9", pid])
                            .output()
                            .await;
                    }
                }
            }
        }
    }

    pub async fn toggle_watch(&self, name: &str) {
        let mut watching = self.watching.write().await;
        let current = *watching.get(name).unwrap_or(&false);
        watching.insert(name.to_string(), !current);
        drop(watching);

        // Save state to file
        let _ = self.save_state().await;

        // Restart the service
        self.start_service(name).await;
    }

    pub async fn kill_service_toggle(&self, name: &str) {
        let current = {
            let status = self.status.read().await;
            status.get(name).cloned().unwrap_or(ServiceStatus::Stopped)
        };

        if matches!(current, ServiceStatus::Killed) {
            // Restart the service - set status to Stopped first so start_service doesn't reject it
            {
                let mut status = self.status.write().await;
                status.insert(name.to_string(), ServiceStatus::Stopped);
            }
            self.start_service(name).await;
        } else {
            // Kill the service
            self.kill_service(name).await;
            let mut status = self.status.write().await;
            status.insert(name.to_string(), ServiceStatus::Killed);
        }

        // Save state to file
        let _ = self.save_state().await;
    }

    pub async fn get_status(&self) -> HashMap<String, ServiceStatus> {
        self.status.read().await.clone()
    }

    pub async fn get_watching(&self) -> HashMap<String, bool> {
        self.watching.read().await.clone()
    }

    pub async fn get_hidden(&self) -> HashMap<String, bool> {
        self.hidden.read().await.clone()
    }

    pub fn get_base_dir(&self) -> &std::path::Path {
        &self.base_dir
    }

    pub async fn get_logs(&self) -> Vec<(String, String, u64, String)> {
        self.logs.read().await.clone()
    }

    pub async fn clear_logs(&self) {
        let mut logs = self.logs.write().await;
        logs.clear();
    }

    pub async fn save_state(&self) -> Result<(), Box<dyn std::error::Error>> {
        let watching = self.watching.read().await.clone();
        let hidden = self.hidden.read().await.clone();

        // Load existing state to preserve theme
        let mut theme = None;
        let state_file = self.base_dir.join("state.json");
        if state_file.exists() {
            if let Ok(content) = std::fs::read_to_string(state_file) {
                if let Ok(existing_state) = serde_json::from_str::<crate::types::SetStateRequest>(&content) {
                    theme = existing_state.theme;
                }
            }
        }

        let state = crate::types::SetStateRequest {
            watching: Some(watching),
            hidden: Some(hidden),
            theme,
        };

        let json = serde_json::to_string_pretty(&state)?;
        std::fs::write(self.base_dir.join("state.json"), json)?;
        Ok(())
    }

    pub async fn save_state_with_theme(&self, theme: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
        let watching = self.watching.read().await.clone();
        let hidden = self.hidden.read().await.clone();

        let state = crate::types::SetStateRequest {
            watching: Some(watching),
            hidden: Some(hidden),
            theme,
        };

        let json = serde_json::to_string_pretty(&state)?;
        std::fs::write(self.base_dir.join("state.json"), json)?;
        Ok(())
    }

    pub async fn set_watch(&self, name: &str, watching: bool) {
        // Check if the watch state is actually changing
        let current_watching = {
            let watch_map = self.watching.read().await;
            *watch_map.get(name).unwrap_or(&false)
        };

        // Only restart if the state actually changed
        if current_watching == watching {
            // State hasn't changed, just save it
            let mut watch_map = self.watching.write().await;
            watch_map.insert(name.to_string(), watching);
            drop(watch_map);
            let _ = self.save_state().await;
            return;
        }

        // State changed, update it
        let mut watch_map = self.watching.write().await;
        watch_map.insert(name.to_string(), watching);
        drop(watch_map);

        // Save state to file
        let _ = self.save_state().await;

        // Restart the service with the appropriate command (watcher or non-watcher)
        self.start_service(name).await;
    }

    pub async fn set_hidden(&self, name: &str, hidden: bool) {
        let mut hidden_map = self.hidden.write().await;
        hidden_map.insert(name.to_string(), hidden);
        drop(hidden_map);

        // Save state to file
        let _ = self.save_state().await;
    }

    pub async fn restart_service(&self, name: &str) {
        // Kill the service first (this handles ports and processes)
        self.kill_service(name).await;

        // Ensure process is removed from processes map (in case it already finished)
        {
            let mut processes = self.processes.write().await;
            processes.remove(name);
        }

        // Force status to Stopped so start_service will run
        {
            let mut status = self.status.write().await;
            status.insert(name.to_string(), ServiceStatus::Stopped);
        }

        // Small delay to ensure cleanup completes
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Now start the service - it will handle spawning and status updates
        self.start_service(name).await;
    }

    pub async fn restart_all_services(&self) {
        // Clear all logs first
        self.clear_logs().await;

        self.log("system", "Restarting all services...".to_string()).await;

        // Get all service names from status
        let service_names: Vec<String> = {
            let status = self.status.read().await;
            status.keys().cloned().collect()
        };

        // Restart all services
        for service_name in service_names {
            // Skip shared if it's in watch mode (same logic as restart_service)
            if service_name == "shared" {
                let watching = self.watching.read().await;
                if *watching.get("shared").unwrap_or(&false) {
                    continue;
                }
            }
            self.restart_service(&service_name).await;
        }

        self.log("system", "All services restarted.".to_string()).await;
    }

    pub async fn kill_all_services(&self) {
        // Set quitting flag to prevent new services from starting
        {
            let mut quitting = self.quitting.write().await;
            *quitting = true;
        }

        self.log("system", "Shutting down all services...".to_string()).await;

        // Get all service names
        let service_names: Vec<String> = {
            let status = self.status.read().await;
            status.keys().cloned().collect()
        };

        // Kill all services
        for service_name in service_names {
            self.kill_service(&service_name).await;
        }

        self.log("system", "All services stopped.".to_string()).await;
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
}
