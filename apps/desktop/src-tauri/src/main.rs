//! Tauri desktop entry point for Notedash.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::Manager;
#[cfg(target_os = "linux")]
use zbus::blocking::{Connection, Proxy};
#[cfg(target_os = "linux")]
use zbus::zvariant::OwnedValue;

/// Returns a lightweight health value for desktop integration checks.
#[tauri::command]
fn app_health() -> &'static str {
    "ok"
}

/// Returns Linux system color scheme from XDG portal settings.
#[tauri::command]
fn linux_portal_color_scheme() -> Option<&'static str> {
    detect_linux_portal_color_scheme()
}

/// Reads Linux color preference from `org.freedesktop.portal.Settings`.
#[cfg(target_os = "linux")]
fn detect_linux_portal_color_scheme() -> Option<&'static str> {
    let connection = Connection::session().ok()?;
    let proxy = Proxy::new(
        &connection,
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Settings",
    )
    .ok()?;

    let response: OwnedValue = proxy
        .call("Read", &("org.freedesktop.appearance", "color-scheme"))
        .ok()?;
    let color_scheme = u32::try_from(response).ok()?;

    map_linux_portal_color_scheme(color_scheme)
}

/// Provides a no-op portal color preference value on non-Linux targets.
#[cfg(not(target_os = "linux"))]
fn detect_linux_portal_color_scheme() -> Option<&'static str> {
    None
}

/// Maps XDG portal color-scheme values to Notedash theme labels.
fn map_linux_portal_color_scheme(value: u32) -> Option<&'static str> {
    match value {
        1 => Some("dark"),
        2 => Some("light"),
        _ => None,
    }
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
    /// Whether the note is marked as pinned.
    is_pinned: bool,
    /// Whether the note is marked as favorite.
    is_favorite: bool,
}

/// Represents normalized preference flags parsed from note content.
#[derive(Debug, Clone, Copy, Default)]
struct NoteFlags {
    /// Whether note metadata signals a pinned note.
    is_pinned: bool,
    /// Whether note metadata signals a favorite note.
    is_favorite: bool,
}

/// Lists markdown notes from a vault path ordered by preference and recency.
#[tauri::command]
fn list_recent_notes(vault_path: String, limit: Option<usize>) -> Vec<NoteMetadata> {
    let root = PathBuf::from(vault_path.trim());
    if !root.exists() || !root.is_dir() {
        return Vec::new();
    }

    let mut files = Vec::<(PathBuf, SystemTime)>::new();
    collect_markdown_files(&root, &mut files);

    let mut notes = files
        .into_iter()
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
            let flags = parse_note_flags(&path);

            Some(NoteMetadata {
                path: relative,
                title,
                updated_at_iso,
                is_pinned: flags.is_pinned,
                is_favorite: flags.is_favorite,
            })
        })
        .collect::<Vec<_>>();

    notes.sort_by(|left, right| {
        note_priority(right)
            .cmp(&note_priority(left))
            .then_with(|| right.updated_at_iso.cmp(&left.updated_at_iso))
    });

    notes.truncate(limit.unwrap_or(12).min(100));
    notes
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

/// Parses pin/favorite note flags from frontmatter and tag hints.
fn parse_note_flags(path: &Path) -> NoteFlags {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(_) => return NoteFlags::default(),
    };

    parse_note_flags_from_content(&content)
}

/// Parses pin/favorite note flags from markdown content.
fn parse_note_flags_from_content(content: &str) -> NoteFlags {
    let mut flags = NoteFlags::default();
    if let Some(frontmatter) = extract_frontmatter(&content) {
        apply_frontmatter_flags(&frontmatter, &mut flags);
    }

    let preview = content.lines().take(120).collect::<Vec<_>>().join("\n");
    apply_tag_flags(&preview, &mut flags);
    flags
}

/// Extracts a YAML frontmatter block when present at the top of a markdown file.
fn extract_frontmatter(content: &str) -> Option<String> {
    let mut lines = content.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }

    let mut block = Vec::new();
    for line in lines {
        if line.trim() == "---" {
            return Some(block.join("\n"));
        }

        block.push(line);
    }

    None
}

/// Applies boolean preference keys and tags from frontmatter lines.
fn apply_frontmatter_flags(frontmatter: &str, flags: &mut NoteFlags) {
    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim().to_ascii_lowercase();
            let value = value.trim().to_ascii_lowercase();

            if matches!(key.as_str(), "pinned" | "pin") {
                flags.is_pinned |= parse_truthy_value(&value);
            }

            if matches!(key.as_str(), "favorite" | "favourite" | "starred") {
                flags.is_favorite |= parse_truthy_value(&value);
            }

            if key == "tags" {
                apply_tag_flags(&value, flags);
            }
        }

        apply_tag_flags(trimmed, flags);
    }
}

/// Applies tag-based preference hints for pin/favorite labels.
fn apply_tag_flags(value: &str, flags: &mut NoteFlags) {
    let normalized = value.to_ascii_lowercase();

    if normalized.contains("#pinned")
        || normalized.contains("#pin")
        || normalized.contains(" pinned")
        || normalized.contains("[pinned]")
    {
        flags.is_pinned = true;
    }

    if normalized.contains("#favorite")
        || normalized.contains("#favourite")
        || normalized.contains("#starred")
        || normalized.contains(" favorite")
        || normalized.contains(" favourite")
        || normalized.contains(" starred")
        || normalized.contains("[favorite]")
        || normalized.contains("[favourite]")
    {
        flags.is_favorite = true;
    }
}

/// Returns whether a YAML-ish value should be treated as true.
fn parse_truthy_value(value: &str) -> bool {
    matches!(
        value.trim_matches('"'),
        "1" | "true" | "yes" | "on" | "y" | "t"
    )
}

/// Returns priority weight used for sorting recent notes.
fn note_priority(note: &NoteMetadata) -> u8 {
    note.is_pinned as u8 + note.is_favorite as u8
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::thread;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    /// Creates a unique temporary vault directory path for a test.
    fn temp_vault_path(test_name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after unix epoch")
            .as_nanos();

        env::temp_dir().join(format!("notedash-{test_name}-{nanos}"))
    }

    /// Writes a markdown note fixture into a test vault.
    fn write_markdown_note(vault_path: &Path, relative_path: &str, content: &str) {
        let path = vault_path.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent directories should be created");
        }

        fs::write(path, content).expect("note fixture should be written");
    }

    /// Verifies frontmatter extraction only succeeds for top-of-file YAML blocks.
    #[test]
    fn extracts_frontmatter_block_from_top_of_file() {
        let content = "---\npinned: true\ntags: [#favorite]\n---\n# Title";
        let frontmatter = extract_frontmatter(content).expect("frontmatter should parse");

        assert!(frontmatter.contains("pinned: true"));
        assert!(frontmatter.contains("tags: [#favorite]"));
    }

    /// Verifies frontmatter extraction ignores blocks not at the beginning.
    #[test]
    fn ignores_non_top_frontmatter_blocks() {
        let content = "# Title\n---\npinned: true\n---";
        assert!(extract_frontmatter(content).is_none());
    }

    /// Verifies truthy parser supports common YAML-ish values.
    #[test]
    fn parses_truthy_values() {
        assert!(parse_truthy_value("true"));
        assert!(parse_truthy_value("\"yes\""));
        assert!(parse_truthy_value("on"));
        assert!(!parse_truthy_value("false"));
        assert!(!parse_truthy_value("off"));
    }

    /// Verifies note flag parsing combines frontmatter booleans and tags.
    #[test]
    fn parses_flags_from_frontmatter_and_tags() {
        let content = "---\npinned: true\ntags: [#favorite]\n---\nBody";
        let flags = parse_note_flags_from_content(content);

        assert!(flags.is_pinned);
        assert!(flags.is_favorite);
    }

    /// Verifies body tag hints are recognized even without frontmatter.
    #[test]
    fn parses_flags_from_body_tag_hints() {
        let content = "# Daily\nNotes with #pinned and #starred context";
        let flags = parse_note_flags_from_content(content);

        assert!(flags.is_pinned);
        assert!(flags.is_favorite);
    }

    /// Verifies note priority favors notes with more preference flags.
    #[test]
    fn computes_note_priority_from_flags() {
        let low = NoteMetadata {
            path: String::from("a.md"),
            title: String::from("A"),
            updated_at_iso: String::from("2026-01-01T00:00:00Z"),
            is_pinned: false,
            is_favorite: true,
        };
        let high = NoteMetadata {
            path: String::from("b.md"),
            title: String::from("B"),
            updated_at_iso: String::from("2026-01-01T00:00:00Z"),
            is_pinned: true,
            is_favorite: true,
        };

        assert!(note_priority(&high) > note_priority(&low));
    }

    /// Verifies vault listing order favors priority flags, then recency.
    #[test]
    fn lists_notes_by_priority_then_recency() {
        let vault = temp_vault_path("priority-order");
        fs::create_dir_all(&vault).expect("test vault should be created");

        write_markdown_note(&vault, "plain.md", "# Plain\nNo flags");
        thread::sleep(Duration::from_millis(1100));

        write_markdown_note(
            &vault,
            "favorite-old.md",
            "---\nfavorite: true\n---\n# Favorite old",
        );
        thread::sleep(Duration::from_millis(1100));

        write_markdown_note(
            &vault,
            "favorite-new.md",
            "---\nfavorite: true\n---\n# Favorite new",
        );
        thread::sleep(Duration::from_millis(1100));

        write_markdown_note(
            &vault,
            "priority.md",
            "---\npinned: true\nfavorite: true\n---\n# Priority",
        );

        let notes = list_recent_notes(vault.to_string_lossy().into_owned(), Some(12));
        let ordered_paths = notes
            .iter()
            .map(|note| note.path.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            ordered_paths,
            vec![
                "priority.md",
                "favorite-new.md",
                "favorite-old.md",
                "plain.md"
            ]
        );

        fs::remove_dir_all(vault).expect("test vault should be deleted");
    }

    /// Verifies result limiting is applied after ordering is computed.
    #[test]
    fn applies_limit_after_sorting() {
        let vault = temp_vault_path("limit-order");
        fs::create_dir_all(&vault).expect("test vault should be created");

        write_markdown_note(
            &vault,
            "priority.md",
            "---\npinned: true\nfavorite: true\n---\n# Priority",
        );
        write_markdown_note(&vault, "plain.md", "# Plain\nNo flags");

        let notes = list_recent_notes(vault.to_string_lossy().into_owned(), Some(1));
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].path, "priority.md");

        fs::remove_dir_all(vault).expect("test vault should be deleted");
    }

    /// Verifies Linux portal color-scheme values map to known theme labels.
    #[test]
    fn maps_linux_portal_color_scheme_values() {
        assert_eq!(map_linux_portal_color_scheme(0), None);
        assert_eq!(map_linux_portal_color_scheme(1), Some("dark"));
        assert_eq!(map_linux_portal_color_scheme(2), Some("light"));
        assert_eq!(map_linux_portal_color_scheme(999), None);
    }
}

/// Boots the desktop application and registers Tauri commands.
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_health,
            list_recent_notes,
            linux_portal_color_scheme
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Notedash");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
