//! Tauri desktop entry point for Notedash.

use keyring::{Entry, Error as KeyringError};
use reqwest::blocking::Client;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
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

/// Opens an external URL with the operating system default handler.
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(String::from("URL cannot be empty"));
    }

    open_url_with_system_handler(trimmed)
}

/// Opens a URL using platform-native shell commands.
fn open_url_with_system_handler(url: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(url);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", url]);
        command
    };

    command
        .status()
        .map_err(|error| format!("failed to launch browser command: {error}"))
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(format!("browser command exited with status {status}"))
            }
        })
}

/// Starts Nextcloud login flow v2 and returns browser + polling metadata.
#[tauri::command]
fn nextcloud_login_flow_start(server_url: String) -> Result<NextcloudLoginFlowStart, String> {
    let base_url = normalize_server_base_url(&server_url)?;
    let endpoint = format!("{base_url}/index.php/login/v2");

    let client = Client::builder()
        .user_agent("Notedash/0.1 (+https://github.com/notedash/notedash)")
        .build()
        .map_err(|error| format!("failed to initialize HTTP client: {error}"))?;

    let response = client
        .post(endpoint)
        .send()
        .map_err(|error| format!("failed to start Nextcloud login flow: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to start Nextcloud login flow (HTTP {})",
            response.status().as_u16()
        ));
    }

    response
        .json::<NextcloudLoginFlowStart>()
        .map_err(|error| format!("failed to parse Nextcloud login flow payload: {error}"))
}

/// Polls Nextcloud login flow v2 for app credentials.
#[tauri::command]
fn nextcloud_login_flow_poll(
    endpoint: String,
    token: String,
) -> Result<NextcloudLoginFlowPollResult, String> {
    let endpoint = endpoint.trim();
    let token = token.trim();
    if endpoint.is_empty() || token.is_empty() {
        return Err(String::from("poll endpoint and token are required"));
    }

    let client = Client::builder()
        .user_agent("Notedash/0.1 (+https://github.com/notedash/notedash)")
        .build()
        .map_err(|error| format!("failed to initialize HTTP client: {error}"))?;

    let response = client
        .post(endpoint)
        .form(&[("token", token)])
        .send()
        .map_err(|error| format!("failed to poll Nextcloud login flow: {error}"))?;

    if response.status().as_u16() == 404 {
        return Ok(NextcloudLoginFlowPollResult {
            ready: false,
            credentials: None,
        });
    }

    if !response.status().is_success() {
        return Err(format!(
            "failed to poll Nextcloud login flow (HTTP {})",
            response.status().as_u16()
        ));
    }

    let credentials = response
        .json::<NextcloudLoginCredentials>()
        .map_err(|error| format!("failed to parse Nextcloud login credentials: {error}"))?;

    Ok(NextcloudLoginFlowPollResult {
        ready: true,
        credentials: Some(credentials),
    })
}

/// Persists CalDAV credentials in the operating-system secure store.
#[tauri::command]
fn save_caldav_credentials(
    server_url: String,
    username: String,
    app_password: String,
) -> Result<(), String> {
    let entry = caldav_credential_entry(&server_url, &username)?;
    entry
        .set_password(app_password.trim())
        .map_err(|error| format!("failed to save CalDAV credentials: {error}"))
}

/// Loads CalDAV credentials from the operating-system secure store.
#[tauri::command]
fn load_caldav_credentials(server_url: String, username: String) -> Result<Option<String>, String> {
    let entry = caldav_credential_entry(&server_url, &username)?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("failed to load CalDAV credentials: {error}")),
    }
}

/// Removes CalDAV credentials from the operating-system secure store.
#[tauri::command]
fn clear_caldav_credentials(server_url: String, username: String) -> Result<(), String> {
    let entry = caldav_credential_entry(&server_url, &username)?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("failed to clear CalDAV credentials: {error}")),
    }
}

/// Executes a desktop-side CalDAV request to avoid browser CORS constraints.
#[tauri::command]
fn desktop_caldav_request(
    url: String,
    method: String,
    body: String,
    depth: Option<String>,
    username: Option<String>,
    app_password: Option<String>,
) -> Result<DesktopCaldavResponse, String> {
    let parsed_method = parse_caldav_method(&method)?;

    let mut request = Client::builder()
        .user_agent("Notedash/0.1 (+https://github.com/notedash/notedash)")
        .build()
        .map_err(|error| format!("failed to initialize HTTP client: {error}"))?
        .request(parsed_method, &url)
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(body);

    if let Some(depth_value) = depth
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        request = request.header("Depth", depth_value);
    }

    let trimmed_username = username.as_deref().map(str::trim).unwrap_or_default();
    let trimmed_password = app_password.as_deref().map(str::trim).unwrap_or_default();
    if !trimmed_username.is_empty() && !trimmed_password.is_empty() {
        request = request.basic_auth(trimmed_username, Some(trimmed_password));
    }

    let response = request
        .send()
        .map_err(|error| format!("desktop CalDAV request failed: {error}"))?;

    let status = response.status().as_u16();
    let text = response
        .text()
        .map_err(|error| format!("failed to read CalDAV response body: {error}"))?;

    Ok(DesktopCaldavResponse { status, body: text })
}

/// Defines desktop-side CalDAV request response data.
#[derive(Debug, Clone, Serialize)]
struct DesktopCaldavResponse {
    /// HTTP status code returned by the CalDAV server.
    status: u16,
    /// Raw XML/text response payload.
    body: String,
}

/// Represents Nextcloud login flow v2 polling metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct NextcloudLoginFlowPollMeta {
    /// Polling token used for exchange completion.
    token: String,
    /// Polling endpoint accepting token POST requests.
    endpoint: String,
}

/// Represents Nextcloud login flow v2 bootstrap response.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct NextcloudLoginFlowStart {
    /// Browser URL where the user authenticates.
    login: String,
    /// Polling metadata for token exchange.
    poll: NextcloudLoginFlowPollMeta,
}

/// Represents completed Nextcloud login flow credentials.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NextcloudLoginCredentials {
    /// Canonical server URL returned by Nextcloud.
    server: String,
    /// Nextcloud account username.
    login_name: String,
    /// Generated app password token.
    app_password: String,
}

/// Represents polling response returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NextcloudLoginFlowPollResult {
    /// Whether credentials are ready for consumption.
    ready: bool,
    /// Credentials when polling is complete.
    credentials: Option<NextcloudLoginCredentials>,
}

/// Normalizes server input into an absolute base URL.
fn normalize_server_base_url(raw_value: &str) -> Result<String, String> {
    let trimmed = raw_value.trim();
    if trimmed.is_empty() {
        return Err(String::from("server URL is required"));
    }

    let candidate = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };

    let mut parsed = reqwest::Url::parse(&candidate)
        .map_err(|_| String::from("server URL must be a valid http(s) URL"))?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(String::from("server URL must use http or https"));
    }

    parsed.set_path("");
    parsed.set_query(None);
    parsed.set_fragment(None);

    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

/// Parses and validates supported CalDAV HTTP methods.
fn parse_caldav_method(raw_method: &str) -> Result<Method, String> {
    match raw_method.trim().to_ascii_uppercase().as_str() {
        "PROPFIND" => Ok(Method::from_bytes(b"PROPFIND")
            .expect("PROPFIND should always parse as a valid HTTP method")),
        "REPORT" => Ok(Method::from_bytes(b"REPORT")
            .expect("REPORT should always parse as a valid HTTP method")),
        _ => Err(String::from("unsupported CalDAV method")),
    }
}

/// Creates a keyring entry for CalDAV credentials.
fn caldav_credential_entry(server_url: &str, username: &str) -> Result<Entry, String> {
    let normalized_server = normalize_server_base_url(server_url)?;
    let trimmed_username = username.trim();
    if trimmed_username.is_empty() {
        return Err(String::from(
            "CalDAV username is required for secure credential storage",
        ));
    }

    let account_key = format!("{normalized_server}|{trimmed_username}");
    Entry::new("notedash.caldav", &account_key)
        .map_err(|error| format!("failed to initialize credential store entry: {error}"))
}

/// Reads Linux color preference from `org.freedesktop.portal.Settings`.
#[cfg(target_os = "linux")]
fn detect_linux_portal_color_scheme() -> Option<&'static str> {
    read_portal_color_scheme().or_else(detect_gnome_color_scheme)
}

/// Reads Linux color preference from `org.freedesktop.portal.Settings`.
#[cfg(target_os = "linux")]
fn read_portal_color_scheme() -> Option<&'static str> {
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

/// Reads GNOME color preference via `gsettings` when portal lookup is unavailable.
#[cfg(target_os = "linux")]
fn detect_gnome_color_scheme() -> Option<&'static str> {
    let color_scheme = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).to_string())
        .and_then(|value| map_gnome_color_scheme_output(&value));

    if color_scheme.is_some() {
        return color_scheme;
    }

    Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "gtk-theme"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).to_string())
        .and_then(|value| map_gtk_theme_output(&value))
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

/// Maps `gsettings color-scheme` output to a normalized theme label.
#[cfg(target_os = "linux")]
fn map_gnome_color_scheme_output(value: &str) -> Option<&'static str> {
    let normalized = value.trim().to_ascii_lowercase();

    if normalized.contains("prefer-dark") {
        return Some("dark");
    }

    if normalized.contains("prefer-light") {
        return Some("light");
    }

    None
}

/// Maps GNOME `gtk-theme` output to a normalized theme label.
#[cfg(target_os = "linux")]
fn map_gtk_theme_output(value: &str) -> Option<&'static str> {
    let normalized = value.trim().to_ascii_lowercase();

    if normalized.is_empty() {
        return None;
    }

    if normalized.contains("dark") {
        return Some("dark");
    }

    Some("light")
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

    /// Verifies GNOME `color-scheme` output maps to expected labels.
    #[cfg(target_os = "linux")]
    #[test]
    fn maps_gnome_color_scheme_output() {
        assert_eq!(
            map_gnome_color_scheme_output("'prefer-dark'\n"),
            Some("dark")
        );
        assert_eq!(
            map_gnome_color_scheme_output("'prefer-light'"),
            Some("light")
        );
        assert_eq!(map_gnome_color_scheme_output("'default'"), None);
    }

    /// Verifies GNOME `gtk-theme` output maps dark and light fallbacks.
    #[cfg(target_os = "linux")]
    #[test]
    fn maps_gtk_theme_output() {
        assert_eq!(map_gtk_theme_output("'Adwaita-dark'"), Some("dark"));
        assert_eq!(map_gtk_theme_output("'Adwaita'"), Some("light"));
        assert_eq!(map_gtk_theme_output(""), None);
    }

    /// Verifies server base URL normalization accepts bare hostnames.
    #[test]
    fn normalizes_server_base_url() {
        let normalized = normalize_server_base_url("cloud.example.com")
            .expect("bare host should normalize to https origin");
        assert_eq!(normalized, "https://cloud.example.com");

        let normalized_with_path =
            normalize_server_base_url("https://cloud.example.com/remote.php/dav")
                .expect("paths should be reduced to origin");
        assert_eq!(normalized_with_path, "https://cloud.example.com");
    }

    /// Verifies CalDAV secure store entry rejects empty usernames.
    #[test]
    fn rejects_empty_username_for_secure_store() {
        let error = caldav_credential_entry("https://cloud.example.com", "")
            .expect_err("empty username should be rejected");
        assert!(error.contains("username"));
    }

    /// Verifies CalDAV request method parsing allows only DAV methods.
    #[test]
    fn parses_supported_caldav_methods() {
        assert!(parse_caldav_method("REPORT").is_ok());
        assert!(parse_caldav_method("PROPFIND").is_ok());
        assert!(parse_caldav_method("GET").is_err());
    }
}

/// Boots the desktop application and registers Tauri commands.
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_health,
            list_recent_notes,
            linux_portal_color_scheme,
            open_external_url,
            nextcloud_login_flow_start,
            nextcloud_login_flow_poll,
            save_caldav_credentials,
            load_caldav_credentials,
            clear_caldav_credentials,
            desktop_caldav_request
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
