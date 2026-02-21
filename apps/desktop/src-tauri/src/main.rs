//! Tauri desktop entry point for Notedash.

use tauri::Manager;

/// Returns a lightweight health value for desktop integration checks.
#[tauri::command]
fn app_health() -> &'static str {
    "ok"
}

/// Boots the desktop application and registers Tauri commands.
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_health])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Notedash");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
