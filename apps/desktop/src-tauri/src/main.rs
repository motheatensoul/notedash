//! Tauri desktop entry point for Notedash.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::Manager;

/// Returns a lightweight health value for desktop integration checks.
#[tauri::command]
fn app_health() -> &'static str {
    "ok"
}

/// Represents note metadata returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NoteMetadata {
    /// Path relative to the vault root.
    path: String,
    /// Derived note title.
    title: String,
    /// Last modified timestamp in ISO-8601 format.
    updated_at_iso: String,
}

/// Lists recently modified markdown notes from a vault path.
#[tauri::command]
fn list_recent_notes(vault_path: String, limit: Option<usize>) -> Vec<NoteMetadata> {
    let root = PathBuf::from(vault_path.trim());
    if !root.exists() || !root.is_dir() {
        return Vec::new();
    }

    let mut files = Vec::<(PathBuf, SystemTime)>::new();
    collect_markdown_files(&root, &mut files);

    files.sort_by(|left, right| right.1.cmp(&left.1));

    let take = limit.unwrap_or(12).min(100);
    files
        .into_iter()
        .take(take)
        .filter_map(|(path, modified)| {
            let relative = path
                .strip_prefix(&root)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            let title = path
                .file_stem()
                .and_then(|value| value.to_str())
                .map(|value| value.to_string())
                .unwrap_or_else(|| String::from("Untitled"));
            let updated_at_iso = system_time_to_iso8601(modified)?;

            Some(NoteMetadata {
                path: relative,
                title,
                updated_at_iso,
            })
        })
        .collect()
}

/// Recursively collects markdown files and their modified timestamps.
fn collect_markdown_files(current: &PathBuf, output: &mut Vec<(PathBuf, SystemTime)>) {
    let entries = match fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };

        if file_type.is_dir() {
            collect_markdown_files(&path, output);
            continue;
        }

        if !file_type.is_file() || !is_markdown_file(&path) {
            continue;
        }

        let modified = match entry.metadata().and_then(|metadata| metadata.modified()) {
            Ok(modified) => modified,
            Err(_) => continue,
        };

        output.push((path, modified));
    }
}

/// Returns whether a path uses a markdown extension.
fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| {
            let lower = value.to_ascii_lowercase();
            lower == "md" || lower == "markdown"
        })
        .unwrap_or(false)
}

/// Converts `SystemTime` into an ISO-8601 UTC timestamp string.
fn system_time_to_iso8601(value: SystemTime) -> Option<String> {
    let datetime: chrono::DateTime<chrono::Utc> = value.into();
    Some(datetime.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
}

/// Boots the desktop application and registers Tauri commands.
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_health, list_recent_notes])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Notedash");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
