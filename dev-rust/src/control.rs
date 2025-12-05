use crate::service_manager::ServiceManager;
use crate::types::ServiceStatus;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::sync::broadcast;

// Log entry: (service, message, timestamp, stream)
type LogEntry = (String, String, u64, String);
// Logs storage: thread-safe vector of log entries
type Logs = Arc<RwLock<Vec<LogEntry>>>;

pub struct Control {
    service_manager: Arc<ServiceManager>,
    hidden: Arc<RwLock<HashMap<String, bool>>>,
    perf: Arc<RwLock<bool>>,                 // Perf mode for core service
    theme: Arc<RwLock<Option<String>>>,      // Theme preference (light/dark)
    log_sender: broadcast::Sender<LogEntry>, // (service, message, timestamp, stream)
    logs: Logs,                              // Store logs: (service, message, timestamp, stream)
    base_dir: std::path::PathBuf,
}

impl Control {
    pub fn new_with_state(
        base_dir: std::path::PathBuf,
        state: Option<crate::types::SetStateRequest>,
    ) -> Self {
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

        let mut hidden = HashMap::new();

        // Use provided state or load from file
        let (saved_watching, saved_hidden, saved_theme, saved_perf) = if let Some(state) = state {
            (
                state.watching.unwrap_or_default(),
                state.hidden.unwrap_or_default(),
                state.theme,
                state.perf.unwrap_or(false),
            )
        } else {
            // Load state from JSON file if it exists, otherwise use defaults
            let state_file = base_dir.join("dev-rust-state.json");
            if state_file.exists() {
                if let Ok(content) = std::fs::read_to_string(&state_file) {
                    if let Ok(state) =
                        serde_json::from_str::<crate::types::SetStateRequest>(&content)
                    {
                        (
                            state.watching.unwrap_or_default(),
                            state.hidden.unwrap_or_default(),
                            state.theme,
                            state.perf.unwrap_or(false),
                        )
                    } else {
                        (HashMap::new(), HashMap::new(), None, false)
                    }
                } else {
                    (HashMap::new(), HashMap::new(), None, false)
                }
            } else {
                (HashMap::new(), HashMap::new(), None, false)
            }
        };

        for service in crate::services::get_services() {
            hidden.insert(
                service.name.clone(),
                saved_hidden.get(&service.name).copied().unwrap_or(false),
            );
        }

        let service_manager = Arc::new(ServiceManager::new(
            base_dir.clone(),
            log_sender.clone(),
            saved_watching,
        ));

        Self {
            service_manager,
            hidden: Arc::new(RwLock::new(hidden)),
            perf: Arc::new(RwLock::new(saved_perf)),
            theme: Arc::new(RwLock::new(saved_theme)),
            log_sender,
            logs,
            base_dir,
        }
    }

    pub fn get_log_sender(&self) -> broadcast::Sender<LogEntry> {
        self.log_sender.clone()
    }

    pub async fn start(&self) {
        // Run checks in background (don't wait for them)
        self.spawn_checks();

        // Start all services immediately
        self.service_manager.start_all_services().await;
    }

    fn spawn_checks(&self) {
        let log_sender = self.log_sender.clone();
        let status = self.service_manager.get_status();
        let status_change_sender = self.service_manager.get_status_change_sender();
        let base_dir = self.base_dir.clone();
        tokio::spawn(async move {
            use crate::checks::Checks;
            let checks = Checks::new(log_sender, status, status_change_sender, base_dir);
            checks.run().await;
        });
    }

    // Delegate service management methods to ServiceManager
    pub async fn restart_service(&self, name: &str) {
        eprintln!("DEBUG: Control::restart_service called for {}", name);

        // Handle perf mode for core service
        let perf = if name == "core" {
            *self.perf.read().await
        } else {
            false
        };

        // Kill the service first
        self.service_manager.kill_service(name).await;

        // Ensure process is removed from processes map
        // (ServiceManager handles this internally, but we need to ensure status is reset)
        {
            let status = self.service_manager.get_status();
            let mut status_guard = status.write().await;
            status_guard.insert(name.to_string(), crate::types::ServiceStatus::Stopped);
        }

        // Small delay to ensure cleanup completes
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        eprintln!(
            "DEBUG: Control::restart_service calling start_service_with_perf for {}",
            name
        );
        // Start the service with the correct perf mode
        self.service_manager
            .start_service_with_perf(name, perf)
            .await;
        eprintln!("DEBUG: Control::restart_service completed for {}", name);
    }

    pub async fn restart_all_services(&self) {
        // Clear all logs first
        self.clear_logs().await;
        self.service_manager.restart_all_services().await;
    }

    /// Gracefully stops all services.
    ///
    /// This method performs a clean shutdown by:
    /// - Killing processes on each service's port (catches child processes)
    /// - Killing cargo/rustc processes in service directories
    /// - Killing the spawned process and its process group
    /// - Setting service status to `Killed` (allowing them to be restarted later)
    ///
    /// Services can be restarted after calling this method. The `quitting` flag is not set,
    /// so new services can still be started.
    pub async fn stop_all_services(&self) {
        self.service_manager.stop_all_services().await;
    }

    /// Forcefully kills all services.
    ///
    /// This method performs a forceful shutdown by:
    /// - Setting the `quitting` flag to `true` (prevents new services from starting)
    /// - Directly killing processes without cleanup (no port-based or cargo process cleanup)
    /// - Removing processes from the processes map
    /// - Using a timeout for kill operations
    ///
    /// This is more aggressive than `stop_all_services` and is typically used when
    /// you need to ensure all services are fully terminated (e.g., before purging
    /// target directories). Services cannot be easily restarted after this call
    /// without resetting the `quitting` flag.
    pub async fn kill_all_services(&self) {
        self.service_manager.kill_all_services().await;
    }

    pub async fn toggle_watch(&self, name: &str) {
        self.service_manager.toggle_watch(name).await;
        // Save state to file
        let _ = self.save_state().await;
    }

    pub async fn kill_service_toggle(&self, name: &str) {
        self.service_manager.kill_service_toggle(name).await;
        // Save state to file
        let _ = self.save_state().await;
    }

    pub async fn get_status(&self) -> HashMap<String, ServiceStatus> {
        self.service_manager.get_status_map().await
    }

    pub async fn get_watching(&self) -> HashMap<String, bool> {
        self.service_manager.get_watching_map().await
    }

    pub async fn get_hidden(&self) -> HashMap<String, bool> {
        self.hidden.read().await.clone()
    }

    pub fn get_hidden_arc(&self) -> Arc<RwLock<HashMap<String, bool>>> {
        self.hidden.clone()
    }

    pub async fn get_perf(&self) -> bool {
        *self.perf.read().await
    }

    pub fn get_perf_arc(&self) -> Arc<RwLock<bool>> {
        self.perf.clone()
    }

    pub fn get_service_manager(&self) -> Arc<ServiceManager> {
        self.service_manager.clone()
    }

    pub async fn get_theme(&self) -> Option<String> {
        self.theme.read().await.clone()
    }

    pub async fn set_perf(&self, perf: bool) {
        let current_perf = *self.perf.read().await;

        // Only restart if the state actually changed
        if current_perf == perf {
            return;
        }

        // Update perf state
        {
            let mut perf_state = self.perf.write().await;
            *perf_state = perf;
        }

        // Save state to file
        let _ = self.save_state().await;

        // Restart core service with the new perf mode
        self.restart_service("core").await;
    }

    pub async fn get_logs(&self) -> Vec<LogEntry> {
        self.logs.read().await.clone()
    }

    pub async fn clear_logs(&self) {
        let mut logs = self.logs.write().await;
        logs.clear();
    }

    pub async fn save_state(&self) -> Result<(), Box<dyn std::error::Error>> {
        let watching = self.service_manager.get_watching_map().await;
        let hidden = self.hidden.read().await.clone();
        let perf = *self.perf.read().await;
        let theme = self.theme.read().await.clone();

        let state = crate::types::SetStateRequest {
            watching: Some(watching),
            hidden: Some(hidden),
            theme,
            perf: Some(perf),
        };

        let json = serde_json::to_string_pretty(&state)?;
        std::fs::write(self.base_dir.join("dev-rust-state.json"), json)?;
        Ok(())
    }

    pub async fn save_state_with_theme(
        &self,
        theme: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Update in-memory theme
        {
            let mut theme_state = self.theme.write().await;
            *theme_state = theme.clone();
        }

        let watching = self.service_manager.get_watching_map().await;
        let hidden = self.hidden.read().await.clone();
        let perf = *self.perf.read().await;

        let state = crate::types::SetStateRequest {
            watching: Some(watching),
            hidden: Some(hidden),
            theme,
            perf: Some(perf),
        };

        let json = serde_json::to_string_pretty(&state)?;
        std::fs::write(self.base_dir.join("dev-rust-state.json"), json)?;
        Ok(())
    }

    pub async fn set_watch(&self, name: &str, watching: bool) {
        // Check if the watch state is actually changing
        let current_watching = {
            let watch_map = self.service_manager.get_watching();
            let watch_guard = watch_map.read().await;
            *watch_guard.get(name).unwrap_or(&false)
        };

        // Only restart if the state actually changed
        if current_watching == watching {
            // State hasn't changed, just save it
            let watch_map = self.service_manager.get_watching();
            let mut watch_guard = watch_map.write().await;
            watch_guard.insert(name.to_string(), watching);
            drop(watch_guard);
            let _ = self.save_state().await;
            return;
        }

        // State changed, update it and restart
        self.service_manager.set_watch(name, watching).await;

        // Save state to file
        let _ = self.save_state().await;
    }

    pub async fn set_hidden(&self, name: &str, hidden: bool) {
        let mut hidden_map = self.hidden.write().await;
        hidden_map.insert(name.to_string(), hidden);
        drop(hidden_map);

        // Save state to file
        let _ = self.save_state().await;
    }

    /// Check the size of all target directories
    pub async fn check_target_sizes(&self) -> Vec<(String, u64)> {
        crate::target::check_target_sizes(&self.base_dir).await
    }

    /// Purge all target directories (stops all services first, then deletes)
    pub async fn purge_target_directories(
        &self,
    ) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        // First, forcefully kill all services
        self.kill_all_services().await;

        // Give services more time to fully terminate (especially important for files service)
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Then purge target directories
        crate::target::purge_target_directories(&self.base_dir, self.log_sender.clone()).await
    }
}
