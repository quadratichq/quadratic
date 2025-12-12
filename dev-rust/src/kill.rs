//! Kill manager for terminating processes without freezing the main server.
//!
//! This module spawns kill operations as a SINGLE subprocess to avoid system load.
//! The subprocess handles all kills sequentially (still fast since they're just signals).
//!
//! The main binary is invoked with --kill-all flag and receives service info via stdin.

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

#[cfg(unix)]
use nix::unistd::Pid;

/// Timeout for kill operations before we kill the killer
const KILL_TIMEOUT_MS: u64 = 10000;

/// Info needed to kill a service - serializable for passing to subprocess
#[derive(Clone, Serialize, Deserialize)]
pub struct ServiceKillInfo {
    pub name: String,
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub cwd: Option<String>,
}

/// Manages kill operations as a single subprocess.
pub struct KillManager {
    /// Path to the current executable
    exe_path: String,
}

impl KillManager {
    pub fn new() -> Self {
        let exe_path = std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "dev-rust".to_string());

        Self { exe_path }
    }

    /// Kill a single service by spawning a subprocess.
    pub async fn kill_service(&self, info: &ServiceKillInfo) {
        self.kill_services(vec![info.clone()], KILL_TIMEOUT_MS)
            .await;
    }

    /// Kill multiple services by spawning a SINGLE subprocess.
    /// The subprocess handles all kills, avoiding the overhead of many subprocess spawns.
    pub async fn kill_services(&self, services: Vec<ServiceKillInfo>, timeout_ms: u64) {
        if services.is_empty() {
            return;
        }

        // Serialize the service info to JSON
        let json = match serde_json::to_string(&services) {
            Ok(j) => j,
            Err(e) => {
                eprintln!("Failed to serialize kill info: {}", e);
                return;
            }
        };

        // Spawn a single subprocess that handles all kills
        let mut child = match Command::new(&self.exe_path)
            .arg("--kill-all")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to spawn kill subprocess: {}", e);
                return;
            }
        };

        // Write the JSON to stdin
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(json.as_bytes()).await;
            let _ = stdin.shutdown().await;
        }

        // Wait with timeout
        let result = tokio::time::timeout(Duration::from_millis(timeout_ms), child.wait()).await;

        match result {
            Ok(Ok(_)) => {}
            Ok(Err(e)) => eprintln!("Error waiting for kill subprocess: {}", e),
            Err(_) => {
                // Timeout - kill the subprocess
                let _ = child.kill().await;
                eprintln!("Kill subprocess timed out");
            }
        }
    }

    /// Kill all processes listening on a port (single operation, still uses subprocess).
    pub async fn kill_port(&self, port: u16) -> Result<(), String> {
        let info = ServiceKillInfo {
            name: format!("port-{}", port),
            pid: None,
            port: Some(port),
            cwd: None,
        };
        self.kill_service(&info).await;
        Ok(())
    }

    /// Kill a process group by PGID (single operation, still uses subprocess).
    #[allow(dead_code)]
    pub async fn kill_pgrp(&self, pgid: i32) -> Result<(), String> {
        let info = ServiceKillInfo {
            name: format!("pgrp-{}", pgid),
            pid: Some(pgid as u32),
            port: None,
            cwd: None,
        };
        self.kill_service(&info).await;
        Ok(())
    }

    /// Kill cargo/rustc processes matching a pattern (single operation).
    #[allow(dead_code)]
    pub async fn kill_cargo(&self, cwd: &str) -> Result<(), String> {
        let info = ServiceKillInfo {
            name: format!("cargo-{}", cwd),
            pid: None,
            port: None,
            cwd: Some(cwd.to_string()),
        };
        self.kill_service(&info).await;
        Ok(())
    }
}

// ============================================================================
// Subprocess entry points - these are called when the binary is invoked with
// special flags. They run the actual kill logic and exit.
// ============================================================================

/// Entry point for --kill-all: read JSON from stdin and kill all services.
/// This is the main subprocess entry point that handles all kills in one process.
pub fn run_kill_all() -> i32 {
    use std::io::Read;

    // Read JSON from stdin
    let mut input = String::new();
    if let Err(e) = std::io::stdin().read_to_string(&mut input) {
        eprintln!("Failed to read stdin: {}", e);
        return 1;
    }

    // Parse the JSON
    let services: Vec<ServiceKillInfo> = match serde_json::from_str(&input) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to parse JSON: {}", e);
            return 1;
        }
    };

    let mut total_killed = 0;

    // Kill each service
    for info in services {
        // Kill by port first
        if let Some(port) = info.port {
            total_killed += kill_by_port(port);
        }
        // Kill cargo/rustc processes
        if let Some(ref cwd) = info.cwd {
            total_killed += kill_cargo_processes(cwd);
        }
        // Kill process group
        if let Some(pid) = info.pid {
            total_killed += kill_process_group(pid as i32);
        }
    }

    eprintln!("kill-all: killed {} processes total", total_killed);
    0
}

/// Kill all processes on a port, returns count killed
fn kill_by_port(port: u16) -> i32 {
    #[cfg(unix)]
    {
        let output = std::process::Command::new("lsof")
            .args(["-ti", &format!("tcp:{}", port)])
            .output();

        let output = match output {
            Ok(o) => o,
            Err(_) => return 0,
        };

        if output.stdout.is_empty() {
            return 0;
        }

        let pids_str = String::from_utf8_lossy(&output.stdout);
        let current_pid = nix::unistd::getpid().as_raw();
        let mut killed = 0;

        for pid_str in pids_str.trim().split('\n').filter(|s| !s.is_empty()) {
            if let Ok(pid) = pid_str.trim().parse::<i32>() {
                if pid == current_pid {
                    continue;
                }
                if nix::sys::signal::kill(Pid::from_raw(pid), nix::sys::signal::Signal::SIGKILL)
                    .is_ok()
                {
                    killed += 1;
                }
            }
        }
        killed
    }

    #[cfg(not(unix))]
    {
        0 // Windows handled separately
    }
}

/// Kill cargo/rustc processes for a crate, returns count killed
fn kill_cargo_processes(cwd: &str) -> i32 {
    #[cfg(unix)]
    {
        let package_name = cwd.split('/').next_back().unwrap_or(cwd);
        let crate_name = package_name.replace('-', "_");
        let current_pid = nix::unistd::getpid().as_raw();
        let mut killed = 0;

        // Kill cargo processes
        let cargo_pattern = format!("cargo.*{}", package_name);
        if let Ok(output) = std::process::Command::new("pgrep")
            .args(["-f", &cargo_pattern])
            .output()
        {
            let pids_str = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids_str.trim().split('\n').filter(|s| !s.is_empty()) {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    if pid == current_pid {
                        continue;
                    }
                    let _ = nix::sys::signal::kill(
                        Pid::from_raw(-pid),
                        nix::sys::signal::Signal::SIGKILL,
                    );
                    if nix::sys::signal::kill(Pid::from_raw(pid), nix::sys::signal::Signal::SIGKILL)
                        .is_ok()
                    {
                        killed += 1;
                    }
                }
            }
        }

        // Kill rustc processes
        let rustc_pattern = format!("--crate-name {}", crate_name);
        if let Ok(output) = std::process::Command::new("pgrep")
            .args(["-f", &rustc_pattern])
            .output()
        {
            let pids_str = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids_str.trim().split('\n').filter(|s| !s.is_empty()) {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    if pid == current_pid {
                        continue;
                    }
                    if nix::sys::signal::kill(Pid::from_raw(pid), nix::sys::signal::Signal::SIGKILL)
                        .is_ok()
                    {
                        killed += 1;
                    }
                }
            }
        }
        killed
    }

    #[cfg(not(unix))]
    {
        0
    }
}

/// Kill a process group, returns 1 if successful
fn kill_process_group(pgid: i32) -> i32 {
    #[cfg(unix)]
    {
        let current_pid = nix::unistd::getpid().as_raw();
        if pgid == current_pid || pgid == 0 || pgid == 1 {
            return 0;
        }
        if nix::sys::signal::kill(Pid::from_raw(-pgid), nix::sys::signal::Signal::SIGKILL).is_ok() {
            1
        } else {
            0
        }
    }

    #[cfg(not(unix))]
    {
        0
    }
}

/// Entry point for --kill-port: kill all processes on a port
pub fn run_kill_port(port: u16) -> i32 {
    #[cfg(unix)]
    {
        // Use lsof to find processes on the port
        let output = std::process::Command::new("lsof")
            .args(["-ti", &format!("tcp:{}", port)])
            .output();

        let output = match output {
            Ok(o) => o,
            Err(e) => {
                eprintln!("Failed to run lsof: {}", e);
                return 1;
            }
        };

        if output.stdout.is_empty() {
            // No processes on port
            return 0;
        }

        let pids_str = String::from_utf8_lossy(&output.stdout);
        let current_pid = nix::unistd::getpid().as_raw();
        let mut killed = 0;
        let mut errors = 0;

        for pid_str in pids_str.trim().split('\n').filter(|s| !s.is_empty()) {
            if let Ok(pid) = pid_str.trim().parse::<i32>() {
                // Safety: don't kill ourselves
                if pid == current_pid {
                    continue;
                }

                match nix::sys::signal::kill(Pid::from_raw(pid), nix::sys::signal::Signal::SIGKILL)
                {
                    Ok(()) => killed += 1,
                    Err(_) => errors += 1,
                }
            }
        }

        eprintln!(
            "kill-port {}: killed {} processes, {} errors",
            port, killed, errors
        );
        if errors > 0 { 1 } else { 0 }
    }

    #[cfg(not(unix))]
    {
        // Windows: use netstat + taskkill
        let output = std::process::Command::new("netstat")
            .args(["-ano"])
            .output();

        let output = match output {
            Ok(o) => o,
            Err(e) => {
                eprintln!("Failed to run netstat: {}", e);
                return 1;
            }
        };

        let output_str = String::from_utf8_lossy(&output.stdout);
        let port_str = format!(":{}", port);
        let mut pids = Vec::new();

        for line in output_str.lines() {
            if line.contains(&port_str) && line.contains("LISTENING") {
                if let Some(pid_str) = line.split_whitespace().last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        pids.push(pid);
                    }
                }
            }
        }

        if pids.is_empty() {
            return 0;
        }

        let mut killed = 0;
        let mut errors = 0;

        for pid in pids {
            let result = std::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output();

            match result {
                Ok(o) if o.status.success() => killed += 1,
                _ => errors += 1,
            }
        }

        eprintln!(
            "kill-port {}: killed {} processes, {} errors",
            port, killed, errors
        );
        if errors > 0 { 1 } else { 0 }
    }
}

/// Entry point for --kill-pgrp: kill a process group
pub fn run_kill_pgrp(pgid: i32) -> i32 {
    #[cfg(unix)]
    {
        // Safety: don't kill our own process group
        let current_pid = nix::unistd::getpid().as_raw();
        if pgid == current_pid || pgid == 0 || pgid == 1 {
            eprintln!("Refusing to kill protected PGID {}", pgid);
            return 1;
        }

        // Kill the entire process group (negative PID)
        match nix::sys::signal::kill(Pid::from_raw(-pgid), nix::sys::signal::Signal::SIGKILL) {
            Ok(()) => {
                eprintln!("kill-pgrp {}: success", pgid);
                0
            }
            Err(e) => {
                eprintln!("kill-pgrp {}: error {}", pgid, e);
                1
            }
        }
    }

    #[cfg(not(unix))]
    {
        // Windows doesn't have process groups in the same way
        // Just try to kill the process directly
        let result = std::process::Command::new("taskkill")
            .args(["/F", "/PID", &pgid.to_string()])
            .output();

        match result {
            Ok(o) if o.status.success() => 0,
            _ => 1,
        }
    }
}

/// Entry point for --kill-cargo: kill cargo/rustc processes for a crate
pub fn run_kill_cargo(cwd: &str) -> i32 {
    #[cfg(unix)]
    {
        // Extract package name from cwd
        let package_name = cwd.split('/').next_back().unwrap_or(cwd);
        let crate_name = package_name.replace('-', "_");
        let current_pid = nix::unistd::getpid().as_raw();

        let mut killed = 0;

        // Kill cargo processes for this package
        let cargo_pattern = format!("cargo.*{}", package_name);
        if let Ok(output) = std::process::Command::new("pgrep")
            .args(["-f", &cargo_pattern])
            .output()
        {
            let pids_str = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids_str.trim().split('\n').filter(|s| !s.is_empty()) {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    if pid == current_pid {
                        continue;
                    }
                    // Kill process group first, then process
                    let _ = nix::sys::signal::kill(
                        Pid::from_raw(-pid),
                        nix::sys::signal::Signal::SIGKILL,
                    );
                    if nix::sys::signal::kill(Pid::from_raw(pid), nix::sys::signal::Signal::SIGKILL)
                        .is_ok()
                    {
                        killed += 1;
                    }
                }
            }
        }

        // Kill rustc processes for this crate
        let rustc_pattern = format!("--crate-name {}", crate_name);
        if let Ok(output) = std::process::Command::new("pgrep")
            .args(["-f", &rustc_pattern])
            .output()
        {
            let pids_str = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids_str.trim().split('\n').filter(|s| !s.is_empty()) {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    if pid == current_pid {
                        continue;
                    }
                    if nix::sys::signal::kill(Pid::from_raw(pid), nix::sys::signal::Signal::SIGKILL)
                        .is_ok()
                    {
                        killed += 1;
                    }
                }
            }
        }

        eprintln!("kill-cargo {}: killed {} processes", cwd, killed);
        0
    }

    #[cfg(not(unix))]
    {
        // On Windows, cargo process handling is different
        // The port-based killing should be sufficient
        eprintln!("kill-cargo: not implemented on Windows");
        0
    }
}

/// Check if a port is free (no process listening)
pub async fn is_port_free(port: u16) -> bool {
    #[cfg(unix)]
    {
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
        use std::net::TcpListener;
        TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
    }
}

/// Wait for a port to become free, with timeout
pub async fn wait_for_port_free(port: u16, timeout_ms: u64) -> bool {
    let start = std::time::Instant::now();
    let timeout = Duration::from_millis(timeout_ms);

    while start.elapsed() < timeout {
        if is_port_free(port).await {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_kill_manager_creation() {
        let _km = KillManager::new();
        // Just verify it can be created
    }
}
