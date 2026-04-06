use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppSettings {
	/// UI theme: "light" or "dark".
	#[serde(default)]
	pub theme: Option<String>,
	/// UI zoom level as a percentage (100 = normal).
	#[serde(default)]
	pub zoom: Option<u32>,
	/// Remembered window width from last session.
	#[serde(default)]
	pub window_width: Option<u32>,
	/// Remembered window height from last session.
	#[serde(default)]
	pub window_height: Option<u32>,
	/// Last-used export directory.
	#[serde(default)]
	pub last_export_dir: Option<String>,
	/// Last active module (for restoring on launch).
	#[serde(default)]
	pub last_module: Option<String>,
	/// Whether the sidebar is expanded.
	#[serde(default)]
	pub sidebar_open: Option<bool>,
	/// Working input directory.
	#[serde(default)]
	pub input_dir: Option<String>,
	/// Working output directory.
	#[serde(default)]
	pub output_dir: Option<String>,
	/// Default normal map type: "opengl" or "directx".
	#[serde(default)]
	pub default_normal_type: Option<String>,
	/// Per-module last-used export format (e.g., {"adjust": "png8", "pack": "tga"}).
	#[serde(default)]
	pub last_export_formats: Option<std::collections::HashMap<String, String>>,
	/// Directory tree view mode: "list" or "grid".
	#[serde(default)]
	pub directory_view_mode: Option<String>,
}

fn settings_path() -> Result<PathBuf, String> {
	let config_dir =
		dirs::config_dir().ok_or_else(|| "Could not determine config directory".to_string())?;
	let app_dir = config_dir.join("packi");
	if !app_dir.exists() {
		fs::create_dir_all(&app_dir)
			.map_err(|e| format!("Failed to create config directory: {}", e))?;
	}
	Ok(app_dir.join("settings.json"))
}

/// Write content to a temporary file then rename, preventing corruption on crash.
pub fn atomic_write(path: &PathBuf, content: &str) -> Result<(), String> {
	let tmp_path = path.with_extension("tmp");
	let mut file = fs::File::create(&tmp_path)
		.map_err(|e| format!("Failed to create temp file: {}", e))?;
	file.write_all(content.as_bytes())
		.map_err(|e| format!("Failed to write temp file: {}", e))?;
	file.sync_all()
		.map_err(|e| format!("Failed to sync temp file: {}", e))?;
	fs::rename(&tmp_path, path)
		.map_err(|e| format!("Failed to rename temp file: {}", e))?;
	Ok(())
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
	let path = settings_path()?;
	if !path.exists() {
		return Ok(AppSettings::default());
	}
	let content =
		fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))?;
	serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
	let path = settings_path()?;
	let content = serde_json::to_string_pretty(&settings)
		.map_err(|e| format!("Failed to serialize settings: {}", e))?;
	atomic_write(&path, &content)?;
	Ok(())
}
