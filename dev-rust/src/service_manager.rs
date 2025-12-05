use crate::checks::Checks;
use crate::kill::{KillManager, ServiceKillInfo};
use crate::types::ServiceStatus;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tokio::sync::{Mutex, broadcast};

pub struct ServiceManager {
    processes: Arc<RwLock<HashMap<String, Option<Child>>>>,
    status: Arc<RwLock<HashMap<String, ServiceStatus>>>,
    watching: Arc<RwLock<HashMap<String, bool>>>,
    quitting: Arc<RwLock<bool>>,
    /// Per-service mutex to prevent concurrent starts of the same service.
    /// This prevents race conditions where multiple restarts could spawn multiple processes.
    service_locks: Arc<RwLock<HashMap<String, Arc<Mutex<()>>>>>,
    log_sender: broadcast::Sender<(String, String, u64, String)>,
    status_change_sender: broadcast::Sender<()>, // Notifies when status changes
    base_dir: std::path::PathBuf,
    kill_manager: Arc<KillManager>,
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

        let (status_change_sender, _) = broadcast::channel(100);

        // Create per-service locks
        let mut service_locks = HashMap::new();
        for service in crate::services::get_services() {
            service_locks.insert(service.name.clone(), Arc::new(Mutex::new(())));
        }

        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
            status: Arc::new(RwLock::new(status)),
            watching: Arc::new(RwLock::new(watching)),
            quitting: Arc::new(RwLock::new(false)),
            service_locks: Arc::new(RwLock::new(service_locks)),
            log_sender,
            status_change_sender,
            base_dir,
            kill_manager: Arc::new(KillManager::new()),
        }
    }

    /// Get the lock for a service, creating it if it doesn't exist.
    async fn get_service_lock(&self, name: &str) -> Arc<Mutex<()>> {
        // First try to get existing lock
        {
            let locks = self.service_locks.read().await;
            if let Some(lock) = locks.get(name) {
                return lock.clone();
            }
        }
        // Create new lock if needed
        let mut locks = self.service_locks.write().await;
        locks
            .entry(name.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    pub fn get_status(&self) -> Arc<RwLock<HashMap<String, ServiceStatus>>> {
        self.status.clone()
    }

    pub fn get_watching(&self) -> Arc<RwLock<HashMap<String, bool>>> {
        self.watching.clone()
    }

    pub fn get_status_change_sender(&self) -> broadcast::Sender<()> {
        self.status_change_sender.clone()
    }

    pub async fn get_status_map(&self) -> HashMap<String, ServiceStatus> {
        self.status.read().await.clone()
    }

    pub async fn get_watching_map(&self) -> HashMap<String, bool> {
        self.watching.read().await.clone()
    }

    pub async fn start_all_services(&self) {
        // Set all services to Starting (pending) unless they're Killed
        {
            let mut status = self.status.write().await;
            for service in crate::services::get_services() {
                let current_status = status
                    .get(&service.name)
                    .cloned()
                    .unwrap_or(ServiceStatus::Stopped);
                if !matches!(current_status, ServiceStatus::Killed) {
                    status.insert(service.name.clone(), ServiceStatus::Starting);
                }
            }
        }
        self.notify_status_change();

        // Start all services by default (in logical order: dependencies first)
        // Start types first (needed for core)
        self.start_service("types").await;

        // Start core (needed for client)
        self.start_service("core").await;

        // Start shared (needed for api) and wait for it to complete
        self.start_service("shared").await;

        // Wait for shared to complete before starting API
        // This matches node dev behavior where shared -> db -> api
        self.wait_for_service_success("shared").await;

        // Run database migrations before starting API (matches node dev behavior)
        self.run_db_migrations().await;

        // Start client (can run in parallel with api)
        self.start_service("client").await;

        // Start python
        self.start_service("python").await;

        // Start API (depends on shared and migrations)
        self.start_service("api").await;

        // Wait for API to be ready before starting dependent services
        self.wait_for_service_success("api").await;

        // Start Rust services (depend on API)
        self.start_service("multiplayer").await;
        self.start_service("files").await;
        self.start_service("connection").await;
    }

    /// Wait for a service to reach Running status (or timeout after 60 seconds)
    async fn wait_for_service_success(&self, name: &str) {
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(60);

        loop {
            {
                let status = self.status.read().await;
                match status.get(name) {
                    Some(ServiceStatus::Running) => {
                        self.log(name, format!("{} is ready", name)).await;
                        return;
                    }
                    Some(ServiceStatus::Error) => {
                        self.log(name, format!("{} failed, continuing anyway", name))
                            .await;
                        return;
                    }
                    Some(ServiceStatus::Killed) => {
                        self.log(name, format!("{} was killed, skipping wait", name))
                            .await;
                        return;
                    }
                    _ => {}
                }
            }

            if start.elapsed() > timeout {
                self.log(
                    name,
                    format!("{} did not become ready within timeout, continuing", name),
                )
                .await;
                return;
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    }

    /// Run database migrations (matches node dev runDb behavior)
    async fn run_db_migrations(&self) {
        self.log("db", "Running database migrations...".to_string())
            .await;

        // Update a pseudo-status for db (we don't have a separate db service)
        // Just log the migration status

        let output = Command::new("npm")
            .args(["run", "prisma:migrate", "--workspace=quadratic-api"])
            .current_dir(&self.base_dir)
            .output()
            .await;

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                let stderr = String::from_utf8_lossy(&o.stderr);

                // Log the output
                for line in stdout.lines() {
                    if !line.trim().is_empty() {
                        self.log("db", line.to_string()).await;
                    }
                }
                for line in stderr.lines() {
                    if !line.trim().is_empty() {
                        self.log("db", line.to_string()).await;
                    }
                }

                if o.status.success() {
                    self.log(
                        "db",
                        "Database migrations completed successfully".to_string(),
                    )
                    .await;
                } else {
                    self.log(
                        "db",
                        "Database migrations failed, API may not work correctly".to_string(),
                    )
                    .await;
                }
            }
            Err(e) => {
                self.log("db", format!("Failed to run migrations: {}", e))
                    .await;
            }
        }
    }

    pub async fn start_service(&self, name: &str) {
        self.start_service_with_perf(name, false).await;
    }

    pub async fn start_service_with_perf(&self, name: &str, perf: bool) {
        eprintln!("DEBUG: start_service_with_perf called for {}", name);
        if *self.quitting.read().await {
            eprintln!("DEBUG: start_service_with_perf - quitting is true, returning early");
            return;
        }

        // Handle checks service specially - run checks and exit
        // This is before the Killed check because checks should always run when clicked
        if name == "checks" {
            eprintln!("DEBUG: Running checks service");
            let checks = Checks::new(
                self.log_sender.clone(),
                self.status.clone(),
                self.status_change_sender.clone(),
                self.base_dir.clone(),
            );
            checks.run().await;
            eprintln!("DEBUG: Checks service completed");
            return;
        }

        // Don't start services that are killed - they must be manually restarted
        {
            let status = self.status.read().await;
            if matches!(status.get(name), Some(ServiceStatus::Killed)) {
                return;
            }
        }

        let service = crate::services::get_service_by_name(name);
        let Some(service) = service else {
            return;
        };

        // Acquire per-service lock to prevent concurrent starts of the same service.
        // This prevents race conditions where multiple restarts (e.g., from file watchers)
        // could spawn multiple processes on the same port.
        let lock = self.get_service_lock(name).await;
        let _guard = lock.lock().await;

        // Re-check status after acquiring lock (another start might have completed)
        {
            let status = self.status.read().await;
            if matches!(status.get(name), Some(ServiceStatus::Killed)) {
                return;
            }
        }

        // Kill any existing process for this service
        {
            let processes = self.processes.read().await;
            if processes.get(name).and_then(|p| p.as_ref()).is_some() {
                drop(processes); // Release read lock before calling kill_service
                self.kill_service(name).await;
            }
        }

        // For services with ports, ALWAYS ensure the port is free before starting.
        // Don't rely on had_existing_process - another process could be using the port.
        if let Some(port) = service.port() {
            // Always check and kill processes on the port
            if !crate::kill::is_port_free(port).await {
                // Kill any processes using the port (runs in subprocess)
                if let Err(e) = self.kill_manager.kill_port(port).await {
                    self.log(name, format!("Warning: kill_port failed: {}", e))
                        .await;
                }

                // Give the OS a moment to release the port after killing processes
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }

            // Wait up to 3 seconds for the port to be released (increased from 2s)
            if !crate::kill::wait_for_port_free(port, 3000).await {
                self.log(
                    name,
                    format!(
                        "Error: Port {} is still in use after 3 seconds, aborting start",
                        port
                    ),
                )
                .await;
                // Set status to error since we can't start
                {
                    let mut status = self.status.write().await;
                    status.insert(name.to_string(), ServiceStatus::Error);
                }
                self.notify_status_change();
                return;
            }
        }

        let watching = *self.watching.read().await.get(name).unwrap_or(&false);
        let base_dir = self.base_dir.clone();

        // Log the command being run for debugging (especially for shared)
        if name == "shared" {
            let service_config = service.config();
            let command = if watching {
                service_config.watch_command.as_ref()
            } else {
                Some(&service_config.command)
            };
            if let Some(cmd) = command {
                self.log(name, format!("Running command: {}", cmd.join(" ")))
                    .await;
            }
        }

        let mut cmd = service.build_command(watching, perf, &base_dir);

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                self.log(name, format!("Failed to start: {}", e)).await;
                let mut status = self.status.write().await;
                status.insert(name.to_string(), ServiceStatus::Error);
                drop(status);
                self.notify_status_change();
                return;
            }
        };

        // Log that we've started the process (for debugging)
        self.log(name, "Process spawned successfully".to_string())
            .await;

        // Update status
        {
            let mut status = self.status.write().await;
            status.insert(name.to_string(), ServiceStatus::Starting);
        }
        self.notify_status_change();

        self.log(name, "Starting...".to_string()).await;

        // Handle stdout
        let stdout = child.stdout.take();
        let stdout_handle = if let Some(stdout) = stdout {
            let name = name.to_string();
            let sender = self.log_sender.clone();
            let status = self.status.clone();
            let service_config = service.config();
            let status_notifier = self.status_change_sender.clone();

            Some(tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                loop {
                    match lines.next_line().await {
                        Ok(Some(line)) => {
                            let timestamp = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            let _ = sender.send((
                                name.clone(),
                                line.clone(),
                                timestamp,
                                "stdout".to_string(),
                            ));

                            // Check for success/error patterns using service methods
                            // Don't update status if service is killed
                            let mut status_guard = status.write().await;
                            let current_status = status_guard
                                .get(&name)
                                .cloned()
                                .unwrap_or(ServiceStatus::Stopped);

                            // Don't change status if service is killed
                            if matches!(current_status, ServiceStatus::Killed) {
                                continue;
                            }

                            // Transition to appropriate state whenever pattern is detected, regardless of current state
                            let mut status_changed = false;
                            if service_config
                                .success_patterns
                                .iter()
                                .any(|p| line.contains(p))
                            {
                                status_guard.insert(name.clone(), ServiceStatus::Running);
                                status_changed = true;
                            } else if service_config
                                .error_patterns
                                .iter()
                                .any(|p| line.contains(p))
                            {
                                status_guard.insert(name.clone(), ServiceStatus::Error);
                                status_changed = true;
                            } else if service_config
                                .start_patterns
                                .iter()
                                .any(|p| line.contains(p))
                            {
                                status_guard.insert(name.clone(), ServiceStatus::Starting);
                                status_changed = true;
                            }
                            drop(status_guard);

                            if status_changed {
                                let _ = status_notifier.send(());
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
            }))
        } else {
            None
        };

        // Handle stderr
        let stderr = child.stderr.take();
        let stderr_handle = if let Some(stderr) = stderr {
            if name == "shared" {
                self.log(name, "Setting up stderr reader".to_string()).await;
            }
            let name = name.to_string();
            let sender = self.log_sender.clone();
            let status = self.status.clone();
            let service_config = service.config();
            let status_notifier = self.status_change_sender.clone();

            // For cargo-based services (like core), stderr contains normal informational output
            // We'll check if it's an actual error, otherwise treat as stdout
            let is_cargo_service =
                name == "core" || name == "multiplayer" || name == "files" || name == "connection";
            let error_patterns = service_config.error_patterns.clone();

            Some(tokio::spawn(async move {
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

                            let _ = sender.send((
                                name.clone(),
                                line.clone(),
                                timestamp,
                                stream.to_string(),
                            ));

                            // Check for success/error/start patterns to update status
                            // Don't update status if service is killed
                            let mut status_guard = status.write().await;
                            let current_status = status_guard
                                .get(&name)
                                .cloned()
                                .unwrap_or(ServiceStatus::Stopped);

                            // Don't change status if service is killed
                            if matches!(current_status, ServiceStatus::Killed) {
                                continue;
                            }

                            // Check patterns in order: success, error, start
                            let mut status_changed = false;
                            if service_config
                                .success_patterns
                                .iter()
                                .any(|p| line.contains(p))
                            {
                                status_guard.insert(name.clone(), ServiceStatus::Running);
                                status_changed = true;
                            } else if is_error {
                                status_guard.insert(name.clone(), ServiceStatus::Error);
                                status_changed = true;
                            } else if service_config
                                .start_patterns
                                .iter()
                                .any(|p| line.contains(p))
                            {
                                status_guard.insert(name.clone(), ServiceStatus::Starting);
                                status_changed = true;
                            }
                            drop(status_guard);

                            if status_changed {
                                let _ = status_notifier.send(());
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
            }))
        } else {
            None
        };

        // Store the process - the child's PID is its PGID due to pre_exec setpgid(0,0)
        {
            let mut processes = self.processes.write().await;
            processes.insert(name.to_string(), Some(child));
        }

        // For one-time commands (like shared compile or types), wait for reading tasks to finish
        // This ensures all output is captured even if the process exits quickly
        let is_one_time_command = (name == "shared" && !watching) || name == "types";
        if is_one_time_command {
            if let Some(handle) = stdout_handle {
                let _ = handle.await;
            }
            if let Some(handle) = stderr_handle {
                let _ = handle.await;
            }
        }
    }

    pub async fn kill_service(&self, name: &str) {
        // Get service info for killing
        let service = crate::services::get_service_by_name(name);
        let port = service.as_ref().and_then(|s| s.port());
        let cwd = service.and_then(|s| s.cwd());

        // Remove and get the process handle
        let child = {
            let mut processes = self.processes.write().await;
            processes.remove(name).flatten()
        };

        let pid = child.as_ref().and_then(|c| c.id());

        // Build kill info if there's something to kill
        let info = if pid.is_some() || port.is_some() || cwd.is_some() {
            Some(ServiceKillInfo {
                name: name.to_string(),
                pid,
                port,
                cwd,
            })
        } else {
            None
        };

        // Run kill subprocess if there's something to kill
        if let Some(ref info) = info {
            self.kill_manager.kill_service(info).await;
        }

        // Wait for the child process to exit (if we had one)
        if let Some(mut child) = child {
            let wait_result =
                tokio::time::timeout(tokio::time::Duration::from_secs(2), child.wait()).await;

            match wait_result {
                Ok(Ok(status)) => {
                    self.log(
                        name,
                        format!("Process exited with status: {:?}", status.code()),
                    )
                    .await;
                }
                Ok(Err(e)) => {
                    self.log(name, format!("Error waiting for process: {}", e))
                        .await;
                }
                Err(_) => {
                    // Timeout waiting - try one more kill
                    if let Some(ref info) = info {
                        self.kill_manager.kill_service(info).await;
                    }
                }
            }
        }
    }

    /// Collect kill info for all running services and remove them from processes map.
    /// Only includes services that have something to kill (pid, port, or cwd).
    async fn collect_services_to_kill(&self) -> Vec<ServiceKillInfo> {
        let mut services = Vec::new();
        let mut processes = self.processes.write().await;
        let status = self.status.read().await;

        for name in status.keys() {
            let pid = processes.remove(name).flatten().and_then(|c| c.id());
            let service = crate::services::get_service_by_name(name);
            let port = service.as_ref().and_then(|s| s.port());
            let cwd = service.and_then(|s| s.cwd());

            // Only include if there's something to kill
            if pid.is_some() || port.is_some() || cwd.is_some() {
                services.push(ServiceKillInfo {
                    name: name.clone(),
                    pid,
                    port,
                    cwd,
                });
            }
        }

        services
    }

    pub async fn restart_all_services(&self) {
        // Reset quitting flag to allow services to start
        {
            let mut quitting = self.quitting.write().await;
            *quitting = false;
        }

        self.log("system", "Restarting all services...".to_string())
            .await;

        // Collect services to kill
        let services = self.collect_services_to_kill().await;

        // Reset all service statuses to Stopped immediately
        {
            let mut status = self.status.write().await;
            for name in status.keys().cloned().collect::<Vec<_>>() {
                status.insert(name, ServiceStatus::Stopped);
            }
        }
        self.notify_status_change();

        // Kill all services using centralized logic
        self.kill_manager.kill_services(services, 5000).await;

        // Small delay to ensure cleanup completes
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        // Now start all services in the proper dependency order
        self.start_all_services().await;

        self.log("system", "All services restarted.".to_string())
            .await;
    }

    pub async fn stop_all_services(&self) {
        eprintln!("DEBUG: stop_all_services called");
        self.log("system", "Stopping all services...".to_string())
            .await;

        // Mark all services as Killed immediately (so UI updates right away)
        // Do this BEFORE collecting services to avoid blocking on locks
        {
            let mut status = self.status.write().await;
            for name in status.keys().cloned().collect::<Vec<_>>() {
                status.insert(name, ServiceStatus::Killed);
            }
        }
        self.notify_status_change();
        eprintln!("DEBUG: stop_all_services - statuses set to Killed, spawning kill task");

        // Spawn the entire kill operation as background task - don't await, return immediately
        // This prevents blocking the server/websocket connections
        let processes = self.processes.clone();
        let status = self.status.clone();
        let km = self.kill_manager.clone();
        let log_sender = self.log_sender.clone();

        tokio::spawn(async move {
            // Collect services to kill (inside the spawned task to avoid blocking)
            let services = {
                let mut procs = processes.write().await;
                let stat = status.read().await;
                let mut services = Vec::new();

                for name in stat.keys() {
                    let pid = procs.remove(name).flatten().and_then(|c| c.id());
                    let service = crate::services::get_service_by_name(name);
                    let port = service.as_ref().and_then(|s| s.port());
                    let cwd = service.and_then(|s| s.cwd());

                    if pid.is_some() || port.is_some() || cwd.is_some() {
                        services.push(ServiceKillInfo {
                            name: name.clone(),
                            pid,
                            port,
                            cwd,
                        });
                    }
                }
                services
            };

            km.kill_services(services, 5000).await;

            // Log completion
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let _ = log_sender.send((
                "system".to_string(),
                "All services stopped.".to_string(),
                timestamp,
                "stdout".to_string(),
            ));
        });
    }

    pub async fn kill_all_services(&self) {
        // Set quitting flag to prevent new services from starting
        {
            let mut quitting = self.quitting.write().await;
            *quitting = true;
        }

        self.log("system", "Shutting down all services...".to_string())
            .await;

        // Collect services to kill
        let services = self.collect_services_to_kill().await;

        // Kill all services using centralized logic
        self.kill_manager.kill_services(services, 5000).await;

        self.log("system", "All services stopped.".to_string())
            .await;
    }

    pub async fn toggle_watch(&self, name: &str) {
        let mut watching = self.watching.write().await;
        let current = *watching.get(name).unwrap_or(&false);
        watching.insert(name.to_string(), !current);
        drop(watching);

        // Reset status from Killed to Stopped so start_service will run
        {
            let mut status = self.status.write().await;
            if matches!(status.get(name), Some(ServiceStatus::Killed)) {
                status.insert(name.to_string(), ServiceStatus::Stopped);
            }
        }

        // Restart the service
        self.start_service(name).await;
    }

    pub async fn kill_service_toggle(&self, name: &str) {
        // Acquire per-service lock to prevent racing with concurrent starts
        let lock = self.get_service_lock(name).await;
        let _guard = lock.lock().await;

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
            self.notify_status_change();
            // Release lock before calling start_service (which will acquire it)
            drop(_guard);
            self.start_service(name).await;
        } else {
            // Kill the service
            self.kill_service(name).await;
            let mut status = self.status.write().await;
            status.insert(name.to_string(), ServiceStatus::Killed);
            drop(status);
            self.notify_status_change();
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

        // Reset status from Killed to Stopped so start_service will run
        {
            let mut status = self.status.write().await;
            if matches!(status.get(name), Some(ServiceStatus::Killed)) {
                status.insert(name.to_string(), ServiceStatus::Stopped);
            }
        }

        // Restart the service with the appropriate command (watcher or non-watcher)
        self.start_service(name).await;
    }

    async fn log(&self, service: &str, message: String) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = self.log_sender.send((
            service.to_string(),
            message,
            timestamp,
            "stdout".to_string(),
        ));
    }

    /// Notify subscribers that status has changed
    fn notify_status_change(&self) {
        // Ignore send errors - it's ok if no one is listening
        let _ = self.status_change_sender.send(());
    }
}
