use crate::checks::Checks;
use crate::types::ServiceStatus;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::broadcast;
use tokio::sync::RwLock;

#[cfg(unix)]
use nix::unistd::Pid;

pub struct ServiceManager {
    processes: Arc<RwLock<HashMap<String, Option<Child>>>>,
    status: Arc<RwLock<HashMap<String, ServiceStatus>>>,
    watching: Arc<RwLock<HashMap<String, bool>>>,
    quitting: Arc<RwLock<bool>>,
    log_sender: broadcast::Sender<(String, String, u64, String)>,
    base_dir: std::path::PathBuf,
}

impl ServiceManager {
    pub fn new(
        base_dir: std::path::PathBuf,
        log_sender: broadcast::Sender<(String, String, u64, String)>,
        saved_watching: HashMap<String, bool>,
    ) -> Self {
        let mut status = HashMap::new();
        let mut watching = HashMap::new();

        for service in crate::services::get_services() {
            status.insert(service.name.clone(), ServiceStatus::Stopped);
            // Use saved state if available, otherwise default to true (all services enabled)
            let should_watch = saved_watching.get(&service.name).copied().unwrap_or(true);
            watching.insert(service.name.clone(), should_watch);
        }

        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
            status: Arc::new(RwLock::new(status)),
            watching: Arc::new(RwLock::new(watching)),
            quitting: Arc::new(RwLock::new(false)),
            log_sender,
            base_dir,
        }
    }

    pub fn get_status(&self) -> Arc<RwLock<HashMap<String, ServiceStatus>>> {
        self.status.clone()
    }

    pub fn get_watching(&self) -> Arc<RwLock<HashMap<String, bool>>> {
        self.watching.clone()
    }

    pub async fn get_status_map(&self) -> HashMap<String, ServiceStatus> {
        self.status.read().await.clone()
    }

    pub async fn get_watching_map(&self) -> HashMap<String, bool> {
        self.watching.read().await.clone()
    }

    pub async fn start_all_services(&self) {
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

    pub async fn start_service(&self, name: &str) {
        self.start_service_with_perf(name, false).await;
    }

    pub async fn start_service_with_perf(&self, name: &str, perf: bool) {
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

        // Wait for port to be free if the service uses a port
        if let Some(port) = service.port() {
            // Wait up to 2 seconds for the port to be released
            if !self.wait_for_port_free(port, 2000).await {
                self.log(name, format!("Warning: Port {} may still be in use, proceeding anyway", port)).await;
            } else {
                self.log(name, format!("Port {} is now free", port)).await;
            }
        }

        let watching = *self.watching.read().await.get(name).unwrap_or(&false);
        let base_dir = self.base_dir.clone();
        let mut cmd = service.build_command(watching, perf, &base_dir);

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

        // Store the process - the child's PID is its PGID due to pre_exec setpgid(0,0)
        {
            let mut processes = self.processes.write().await;
            processes.insert(name.to_string(), Some(child));
        }
    }

    pub async fn kill_service(&self, name: &str) {
        // Get the service's port before killing (for fallback)
        let service_port = crate::services::get_service_by_name(name)
            .and_then(|s| s.port());

        // Kill the spawned process and its entire process group
        let mut processes = self.processes.write().await;
        if let Some(Some(mut child)) = processes.remove(name) {
            // Check if the process already exited to avoid killing unrelated reused PIDs
            match child.try_wait() {
                Ok(Some(status)) => {
                    self.log(name, format!("Process already exited with status: {:?}", status.code())).await;
                    return;
                }
                Ok(None) => {
                    // Still running, continue with kill logic
                }
                Err(e) => {
                    self.log(name, format!("Failed to check process state before killing: {}", e)).await;
                }
            }
            let pid = child.id();
            drop(processes); // Release the lock before waiting

            let mut kill_succeeded = false;

            #[cfg(unix)]
            {
                // The child's PID is its PGID due to unsafe_pre_exec setpgid(0,0)
                // Kill the entire process group using kill with negative PID
                if let Some(pid) = pid {
                    // Safety check: don't kill our own process
                    let current_pid = nix::unistd::getpid();
                    if pid as i32 == current_pid.as_raw() {
                        eprintln!(
                            "ERROR: Attempted to kill process {} which is dev-rust itself! Aborting for {}.",
                            pid, name
                        );
                        return;
                    }

                    // Kill the entire process group (PGID = PID due to setpgid in unsafe_pre_exec)
                    // Using negative PID tells kill() to kill the process group
                    match nix::sys::signal::kill(
                        Pid::from_raw(-(pid as i32)),
                        nix::sys::signal::Signal::SIGKILL,
                    ) {
                        Ok(()) => {
                            kill_succeeded = true;
                        }
                        Err(e) => {
                            self.log(name, format!("Warning: Failed to kill process group: {}", e)).await;
                            kill_succeeded = false;
                        }
                    }
                }
            }
            #[cfg(not(unix))]
            {
                // On Windows, just kill the process
                kill_succeeded = child.kill().is_ok();
            }

            // Wait for the process to fully exit with a timeout
            let wait_result = tokio::time::timeout(
                tokio::time::Duration::from_secs(5),
                child.wait()
            ).await;

            match wait_result {
                Ok(Ok(status)) => {
                    self.log(name, format!("Process exited with status: {:?}", status.code())).await;
                }
                Ok(Err(e)) => {
                    self.log(name, format!("Error waiting for process: {}", e)).await;
                }
                Err(_) => {
                    self.log(name, "Process did not exit within timeout, but continuing anyway".to_string()).await;
                }
            }

            // Verify the process is actually gone (Unix only)
            #[cfg(unix)]
            {
                if let Some(pid) = pid {
                    // Check if the process still exists
                    let check_result = nix::sys::signal::kill(
                        Pid::from_raw(pid as i32),
                        nix::sys::signal::Signal::SIGCONT, // Use SIGCONT (harmless) to check if process exists
                    );
                    if check_result.is_ok() {
                        // Process still exists, try killing again
                        self.log(name, format!("Process {} still exists, sending SIGKILL again", pid)).await;
                        match nix::sys::signal::kill(
                            Pid::from_raw(-(pid as i32)),
                            nix::sys::signal::Signal::SIGKILL,
                        ) {
                            Ok(()) => {
                                kill_succeeded = true;
                            }
                            Err(_) => {
                                kill_succeeded = false;
                            }
                        }
                        // Wait a bit more
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    } else {
                        // Process is gone, kill succeeded
                        kill_succeeded = true;
                    }
                }
            }

            // If we failed to kill the process and the service has a port, kill all processes on that port
            if !kill_succeeded {
                if let Some(port) = service_port {
                    self.log(name, format!("Failed to kill process, killing all processes on port {}", port)).await;
                    self.kill_processes_on_port(port).await;
                } else {
                    self.log(name, "Failed to kill process and service has no port to fall back to".to_string()).await;
                }
            }
        }
    }

    async fn is_port_free(&self, port: u16) -> bool {
        #[cfg(unix)]
        {
            // Check if any process is using the port
            let output = Command::new("lsof")
                .args(["-ti", &format!("tcp:{}", port)])
                .output()
                .await;

            if let Ok(output) = output {
                output.stdout.is_empty()
            } else {
                // If lsof fails, assume port might be in use (conservative)
                false
            }
        }
        #[cfg(not(unix))]
        {
            // On Windows, try to bind to the port to check if it's free
            use std::net::TcpListener;
            TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
        }
    }

    async fn wait_for_port_free(&self, port: u16, timeout_ms: u64) -> bool {
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_millis(timeout_ms);

        while start.elapsed() < timeout {
            if self.is_port_free(port).await {
                return true;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }
        false
    }

    async fn kill_processes_on_port(&self, port: u16) {
        #[cfg(unix)]
        {
            // Use lsof to find all processes using the port
            let output = Command::new("lsof")
                .args(["-ti", &format!("tcp:{}", port)])
                .output()
                .await;

            if let Ok(output) = output {
                let pids_str = String::from_utf8_lossy(&output.stdout);
                let pids: Vec<&str> = pids_str.trim().split('\n').filter(|s| !s.is_empty()).collect();

                if pids.is_empty() {
                    self.log("system", format!("No processes found on port {}", port)).await;
                    return;
                }

                // Safety check: don't kill our own process
                let current_pid = nix::unistd::getpid().as_raw();

                for pid_str in pids {
                    if let Ok(pid) = pid_str.trim().parse::<i32>() {
                        // Don't kill our own process
                        if pid == current_pid {
                            self.log("system", format!("Skipping our own process {} on port {}", pid, port)).await;
                            continue;
                        }

                        // Kill the process
                        match nix::sys::signal::kill(
                            Pid::from_raw(pid),
                            nix::sys::signal::Signal::SIGKILL,
                        ) {
                            Ok(()) => {
                                self.log("system", format!("Killed process {} on port {}", pid, port)).await;
                            }
                            Err(e) => {
                                self.log("system", format!("Failed to kill process {} on port {}: {}", pid, port, e)).await;
                            }
                        }
                    }
                }
            } else {
                self.log("system", format!("Failed to find processes on port {}: lsof command failed", port)).await;
            }
        }
        #[cfg(not(unix))]
        {
            // On Windows, use netstat and taskkill
            // Find processes using the port
            let output = Command::new("netstat")
                .args(["-ano"])
                .output()
                .await;

            if let Ok(output) = output {
                let output_str = String::from_utf8_lossy(&output.stdout);
                let port_str = format!(":{}", port);

                // Parse netstat output to find PIDs
                let mut pids = Vec::new();
                for line in output_str.lines() {
                    if line.contains(&port_str) && line.contains("LISTENING") {
                        // Extract PID from the last column
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if let Some(pid_str) = parts.last() {
                            if let Ok(pid) = pid_str.parse::<u32>() {
                                pids.push(pid);
                            }
                        }
                    }
                }

                if pids.is_empty() {
                    self.log("system", format!("No processes found on port {}", port)).await;
                    return;
                }

                // Kill each process
                for pid in pids {
                    let output = Command::new("taskkill")
                        .args(["/F", "/PID", &pid.to_string()])
                        .output()
                        .await;

                    match output {
                        Ok(output) if output.status.success() => {
                            self.log("system", format!("Killed process {} on port {}", pid, port)).await;
                        }
                        Ok(_) => {
                            self.log("system", format!("Failed to kill process {} on port {}", pid, port)).await;
                        }
                        Err(e) => {
                            self.log("system", format!("Error killing process {} on port {}: {}", pid, port, e)).await;
                        }
                    }
                }
            } else {
                self.log("system", format!("Failed to find processes on port {}: netstat command failed", port)).await;
            }
        }
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

    pub async fn stop_all_services(&self) {
        self.log("system", "Stopping all services...".to_string()).await;

        // Get all service names
        let service_names: Vec<String> = {
            let status = self.status.read().await;
            status.keys().cloned().collect()
        };

        // Stop all services (kill and mark as Killed so they can be restarted)
        for service_name in service_names {
            self.kill_service(&service_name).await;
            let mut status = self.status.write().await;
            status.insert(service_name.clone(), ServiceStatus::Killed);
        }

        self.log("system", "All services stopped.".to_string()).await;
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

    pub async fn toggle_watch(&self, name: &str) {
        let mut watching = self.watching.write().await;
        let current = *watching.get(name).unwrap_or(&false);
        watching.insert(name.to_string(), !current);
        drop(watching);

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
    }

    pub async fn set_watch(&self, name: &str, watching: bool) {
        // Check if the watch state is actually changing
        let current_watching = {
            let watch_map = self.watching.read().await;
            *watch_map.get(name).unwrap_or(&false)
        };

        // Only restart if the state actually changed
        if current_watching == watching {
            // State hasn't changed, just update it
            let mut watch_map = self.watching.write().await;
            watch_map.insert(name.to_string(), watching);
            return;
        }

        // State changed, update it
        let mut watch_map = self.watching.write().await;
        watch_map.insert(name.to_string(), watching);
        drop(watch_map);

        // Restart the service with the appropriate command (watcher or non-watcher)
        self.start_service(name).await;
    }


    async fn log(&self, service: &str, message: String) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = self.log_sender.send((service.to_string(), message, timestamp, "stdout".to_string()));
    }
}
