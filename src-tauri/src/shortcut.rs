use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

pub const DEFAULT_HOTKEY: &str = "Control+Alt+Space";
const CAPTURE: &str = "capture";

/// Swaps whatever is registered for the given accelerator. Returns the macOS
/// error verbatim when a combination is already spoken for.
pub fn register(app: &AppHandle, accelerator: &str) -> Result<(), String> {
    let manager = app.global_shortcut();
    let _ = manager.unregister_all();
    manager.register(accelerator).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_hotkey(app: AppHandle, accelerator: String) -> Result<(), String> {
    register(&app, &accelerator)
}

/// Brings the capture bar to the front of whatever the user is doing.
pub fn show_capture(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(CAPTURE) {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn hide_capture(app: AppHandle) {
    if let Some(window) = app.get_webview_window(CAPTURE) {
        let _ = window.hide();
    }
}

/// The capture bar never writes to tide.json. It hands the line to the main
/// window, which is the only writer, and disappears.
#[tauri::command]
pub fn submit_capture(app: AppHandle, text: String) {
    let _ = app.emit_to("main", "tide://capture", text);
    if let Some(window) = app.get_webview_window(CAPTURE) {
        let _ = window.hide();
    }
}
