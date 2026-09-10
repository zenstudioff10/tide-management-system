mod shortcut;
mod storage;
mod tray;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{Emitter, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

/// Set once the interface has confirmed its last write, so quitting can be
/// held open exactly once while that happens.
static FLUSHED: AtomicBool = AtomicBool::new(false);

/// Called by the interface when its pending save is on disk.
#[tauri::command]
fn confirm_exit(app: tauri::AppHandle) {
    FLUSHED.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // fire on the press; the release would open it a second time
                    if event.state() == ShortcutState::Pressed {
                        shortcut::show_capture(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            storage::load_data,
            storage::save_data,
            storage::save_status,
            storage::data_path,
            confirm_exit,
            storage::export_data,
            storage::import_data,
            tray::update_tray,
            shortcut::set_hotkey,
            shortcut::hide_capture,
            shortcut::submit_capture,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            tray::build(app.handle())?;

            let hotkey = storage::saved_hotkey(app.handle())
                .unwrap_or_else(|| shortcut::DEFAULT_HOTKEY.to_string());
            if let Err(err) = shortcut::register(app.handle(), &hotkey) {
                log::warn!("could not register {hotkey}: {err}");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // closing the window parks Tide in the menu bar; reminders and
                // the running session survive. Quit lives in the tray menu.
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Quit used to kill the process mid-debounce, taking the last edit
            // with it. Hold the exit once, ask the interface to flush, and let
            // confirm_exit finish the job — with a deadline so a wedged webview
            // can never trap the app open.
            if let RunEvent::ExitRequested { api, .. } = &event {
                if !FLUSHED.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = app.emit("tide://flush", ());

                    let handle = app.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(1200));
                        if !FLUSHED.swap(true, Ordering::SeqCst) {
                            handle.exit(0);
                        }
                    });
                }
            }
        });
}
