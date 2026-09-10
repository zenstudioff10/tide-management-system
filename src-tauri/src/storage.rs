use std::fs;
use std::path::PathBuf;

use chrono::Local;
use tauri::{AppHandle, Manager};

const FILE: &str = "tide.json";
const BACKUP_DIR: &str = "backups";
const KEEP_BACKUPS: usize = 20;
/// a fresh backup at most this often, so a busy afternoon does not bury the folder
const BACKUP_EVERY_SECS: u64 = 900;
/// a copy somewhere the user actually looks, written once a day
const MIRROR_DIR: &str = "Tide";

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(dir(app)?.join(FILE))
}

#[tauri::command]
pub fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    let path = file(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    match fs::read_to_string(&path) {
        Ok(raw) if !raw.trim().is_empty() => Ok(Some(raw)),
        // a truncated file is not a reason to lose a year of work
        _ => Ok(newest_backup(&app)?.and_then(|p| fs::read_to_string(p).ok())),
    }
}

/// Writes to a sibling temp file and renames it into place, so an interrupted
/// write can never leave a half-written tide.json behind.
#[tauri::command]
pub fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    let path = file(&app)?;
    rotate_backups(&app, &path)?;

    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json.as_bytes()).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;

    // a copy in Documents, once a day: the app's own folder is not somewhere
    // anyone thinks to look, and this one rides along with iCloud
    let _ = mirror_daily(&app, &json);
    Ok(())
}

/// Where today's visible copy lives, whether or not it has been written yet.
fn mirror_path(app: &AppHandle) -> Result<PathBuf, String> {
    let documents = app.path().document_dir().map_err(|e| e.to_string())?;
    let folder = documents.join(MIRROR_DIR);
    let stamp = Local::now().format("%Y-%m-%d").to_string();
    Ok(folder.join(format!("tide-{stamp}.json")))
}

fn mirror_daily(app: &AppHandle, json: &str) -> Result<(), String> {
    let target = mirror_path(app)?;
    if target.exists() {
        return Ok(()); // today's copy is already there
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&target, json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

/// What the interface shows in Settings, so "saved" is a fact rather than faith.
#[derive(serde::Serialize)]
pub struct SaveStatus {
    path: String,
    saved_at: Option<u64>,
    backups: usize,
    mirror: String,
    mirror_written: bool,
}

#[tauri::command]
pub fn save_status(app: AppHandle) -> Result<SaveStatus, String> {
    let path = file(&app)?;
    let saved_at = fs::metadata(&path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    let mirror = mirror_path(&app)?;

    Ok(SaveStatus {
        path: path.to_string_lossy().to_string(),
        saved_at,
        backups: list_backups(&app).map(|b| b.len()).unwrap_or(0),
        mirror: mirror.to_string_lossy().to_string(),
        mirror_written: mirror.exists(),
    })
}

#[tauri::command]
pub fn data_path(app: AppHandle) -> Result<String, String> {
    Ok(file(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_data(path: String, json: String) -> Result<(), String> {
    fs::write(path, json.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_data(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

/// Whatever hotkey the settings file remembers, read before any window exists.
pub fn saved_hotkey(app: &AppHandle) -> Option<String> {
    let raw = fs::read_to_string(file(app).ok()?).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value
        .get("settings")?
        .get("hotkey")?
        .as_str()
        .map(|s| s.to_string())
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = dir(app)?.join(BACKUP_DIR);
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn newest_backup(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let mut entries = list_backups(app)?;
    Ok(entries.pop())
}

/// oldest first
fn list_backups(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut entries: Vec<PathBuf> = fs::read_dir(backup_dir(app)?)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map(|x| x == "json").unwrap_or(false))
        .collect();
    entries.sort();
    Ok(entries)
}

fn rotate_backups(app: &AppHandle, current: &PathBuf) -> Result<(), String> {
    if !current.exists() {
        return Ok(());
    }

    let newest = list_backups(app)?.last().cloned();

    // one backup per quarter hour is plenty — except that every day must have
    // at least one of its own, however quiet that day was
    let today = Local::now().format("%Y%m%d").to_string();
    let newest_is_today = newest
        .as_ref()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .map(|name| name.contains(&today))
        .unwrap_or(false);

    let recent_enough = newest_is_today
        && newest
            .as_ref()
            .and_then(|p| fs::metadata(p).ok())
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.elapsed().ok())
            .map(|age| age.as_secs() < BACKUP_EVERY_SECS)
            .unwrap_or(false);
    if recent_enough {
        return Ok(());
    }

    let stamp = Local::now().format("%Y%m%d-%H%M").to_string();
    let target = backup_dir(app)?.join(format!("tide-{stamp}.json"));
    fs::copy(current, target).map_err(|e| e.to_string())?;

    let all = list_backups(app)?;
    if all.len() > KEEP_BACKUPS {
        for old in &all[..all.len() - KEEP_BACKUPS] {
            let _ = fs::remove_file(old);
        }
    }
    Ok(())
}
