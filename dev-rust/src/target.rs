use std::path::{Path, PathBuf};
use tokio::sync::broadcast;

/// Find the project root by looking for the workspace Cargo.toml or package.json file
pub fn find_project_root(base_dir: &Path) -> Option<PathBuf> {
    let mut current = base_dir.to_path_buf();

    // If we're in dev-rust directory, go up one level first
    if current
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s == "dev-rust")
        .unwrap_or(false)
        && let Some(parent) = current.parent()
    {
        current = parent.to_path_buf();
    }

    loop {
        // Check if this directory contains a Cargo.toml with [workspace] or package.json
        let cargo_toml = current.join("Cargo.toml");
        let package_json = current.join("package.json");

        if cargo_toml.exists()
            && let Ok(contents) = std::fs::read_to_string(&cargo_toml)
            && contents.contains("[workspace]")
        {
            return Some(current);
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

/// Find all /target directories in the project recursively
pub fn find_target_directories(base_dir: &Path) -> Vec<PathBuf> {
    let project_root = find_project_root(base_dir).unwrap_or_else(|| base_dir.to_path_buf());
    let mut target_dirs = Vec::new();

    // Recursively walk through the directory tree looking for target directories
    fn walk_directory(dir: &Path, target_dirs: &mut Vec<PathBuf>, project_root: &Path) {
        // Skip node_modules, .git, and other common directories that shouldn't be searched
        let dir_name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if dir_name == "node_modules" || dir_name == ".git" || dir_name == "target" {
            return;
        }

        // Check if this directory has a target subdirectory
        let target_path = dir.join("target");
        if target_path.exists() && target_path.is_dir() {
            // Exclude dev-rust/target to prevent breaking the dev server
            let target_str = target_path
                .strip_prefix(project_root)
                .unwrap_or(&target_path)
                .to_string_lossy()
                .to_string();
            if !target_str.contains("dev-rust/target") {
                target_dirs.push(target_path);
            }
        }

        // Recursively search subdirectories
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk_directory(&path, target_dirs, project_root);
                }
            }
        }
    }

    walk_directory(&project_root, &mut target_dirs, &project_root);
    target_dirs
}

/// Calculate the size of a directory recursively
pub fn calculate_directory_size(path: &Path) -> u64 {
    let mut total_size = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                total_size += calculate_directory_size(&entry_path);
            } else if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }
    }
    total_size
}

/// Check the size of all target directories
pub async fn check_target_sizes(base_dir: &Path) -> Vec<(String, u64)> {
    let target_dirs = find_target_directories(base_dir);
    let project_root = find_project_root(base_dir).unwrap_or_else(|| base_dir.to_path_buf());
    let mut results = Vec::new();

    for target_dir in target_dirs {
        let size = tokio::task::spawn_blocking({
            let target_dir = target_dir.clone();
            move || calculate_directory_size(&target_dir)
        })
        .await
        .unwrap_or(0);

        let display_path = target_dir
            .strip_prefix(&project_root)
            .unwrap_or(&target_dir)
            .to_string_lossy()
            .to_string();

        results.push((display_path, size));
    }

    results.sort_by(|a, b| b.1.cmp(&a.1)); // Sort by size descending
    results
}

/// Purge all target directories
pub async fn purge_target_directories(
    base_dir: &Path,
    log_sender: broadcast::Sender<(String, String, u64, String)>,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let mut target_dirs = find_target_directories(base_dir);
    let project_root = find_project_root(base_dir).unwrap_or_else(|| base_dir.to_path_buf());

    // Filter out dev-rust/target as a safety measure (should already be excluded, but double-check)
    target_dirs.retain(|target_dir| {
        let target_str = target_dir
            .strip_prefix(&project_root)
            .unwrap_or(target_dir)
            .to_string_lossy()
            .to_string();
        !target_str.contains("dev-rust/target")
    });

    let total = target_dirs.len();
    let mut deleted = Vec::new();

    // Send initial progress message
    log_message(
        &log_sender,
        "target-purge",
        format!("PROGRESS:0:{}:Starting deletion...", total),
    );

    for (index, target_dir) in target_dirs.iter().enumerate() {
        let target_str = target_dir
            .strip_prefix(&project_root)
            .unwrap_or(target_dir)
            .to_string_lossy()
            .to_string();

        let current = index + 1;
        let progress = (current * 100) / total.max(1);

        // Send progress update
        log_message(
            &log_sender,
            "target-purge",
            format!("PROGRESS:{}:{}:Deleting {}", progress, total, target_str),
        );

        let result = tokio::task::spawn_blocking({
            let target_dir = target_dir.clone();
            move || std::fs::remove_dir_all(&target_dir)
        })
        .await;

        match result {
            Ok(Ok(_)) => {
                deleted.push(target_str.clone());
                log_message(
                    &log_sender,
                    "target-purge",
                    format!("Deleted: {}", target_str),
                );
            }
            Ok(Err(e)) => {
                log_error(
                    &log_sender,
                    "target-purge",
                    format!("Failed to delete {}: {}", target_str, e),
                );
            }
            Err(e) => {
                log_error(
                    &log_sender,
                    "target-purge",
                    format!("Error deleting {}: {}", target_str, e),
                );
            }
        }
    }

    // Send completion message
    log_message(
        &log_sender,
        "target-purge",
        format!("PROGRESS:100:{}:Deletion complete", total),
    );

    Ok(deleted)
}

fn log_message(
    sender: &broadcast::Sender<(String, String, u64, String)>,
    service: &str,
    message: String,
) {
    log_with_stream(sender, service, message, "stdout");
}

fn log_error(
    sender: &broadcast::Sender<(String, String, u64, String)>,
    service: &str,
    message: String,
) {
    log_with_stream(sender, service, message, "stderr");
}

fn log_with_stream(
    sender: &broadcast::Sender<(String, String, u64, String)>,
    service: &str,
    message: String,
    stream: &str,
) {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let _ = sender.send((service.to_string(), message, timestamp, stream.to_string()));
}
