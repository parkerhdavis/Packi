use serde::{Deserialize, Serialize};
use std::fs;

use crate::settings::atomic_write;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackingPreset {
	pub name: String,
	pub description: String,
	pub builtin: bool,
	pub labels: ChannelLabels,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelLabels {
	pub r: String,
	pub g: String,
	pub b: String,
	pub a: String,
}

/// Return built-in packing presets.
#[tauri::command]
pub fn get_builtin_presets() -> Vec<PackingPreset> {
	vec![
		PackingPreset {
			name: "Unity HDRP Mask Map".to_string(),
			description: "Metallic / AO / Detail Mask / Smoothness".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "Metallic".to_string(),
				g: "AO".to_string(),
				b: "Detail Mask".to_string(),
				a: "Smoothness".to_string(),
			},
		},
		PackingPreset {
			name: "Unreal ORM".to_string(),
			description: "AO / Roughness / Metallic".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "AO".to_string(),
				g: "Roughness".to_string(),
				b: "Metallic".to_string(),
				a: "Unused".to_string(),
			},
		},
		PackingPreset {
			name: "Unity URP".to_string(),
			description: "Metallic / AO / unused / Smoothness".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "Metallic".to_string(),
				g: "AO".to_string(),
				b: "Unused".to_string(),
				a: "Smoothness".to_string(),
			},
		},
	]
}

/// Load user-defined presets from disk.
#[tauri::command]
pub fn load_user_presets() -> Result<Vec<PackingPreset>, String> {
	let path = presets_path()?;
	if !path.exists() {
		return Ok(Vec::new());
	}
	let content =
		fs::read_to_string(&path).map_err(|e| format!("Failed to read presets: {}", e))?;
	serde_json::from_str(&content).map_err(|e| format!("Failed to parse presets: {}", e))
}

/// Save a user-defined preset.
#[tauri::command]
pub fn save_user_preset(preset: PackingPreset) -> Result<(), String> {
	let mut presets = load_user_presets().unwrap_or_default();

	// Replace if name matches, otherwise append
	if let Some(idx) = presets.iter().position(|p| p.name == preset.name) {
		presets[idx] = preset;
	} else {
		presets.push(preset);
	}

	let path = presets_path()?;
	let content = serde_json::to_string_pretty(&presets)
		.map_err(|e| format!("Failed to serialize presets: {}", e))?;
	atomic_write(&path, &content)?;
	Ok(())
}

/// Delete a user-defined preset by name.
#[tauri::command]
pub fn delete_user_preset(name: String) -> Result<(), String> {
	let mut presets = load_user_presets().unwrap_or_default();
	presets.retain(|p| p.name != name);

	let path = presets_path()?;
	let content = serde_json::to_string_pretty(&presets)
		.map_err(|e| format!("Failed to serialize presets: {}", e))?;
	atomic_write(&path, &content)?;
	Ok(())
}

fn presets_path() -> Result<std::path::PathBuf, String> {
	let config_dir =
		dirs::config_dir().ok_or_else(|| "Could not determine config directory".to_string())?;
	let app_dir = config_dir.join("packi");
	if !app_dir.exists() {
		fs::create_dir_all(&app_dir)
			.map_err(|e| format!("Failed to create config directory: {}", e))?;
	}
	Ok(app_dir.join("presets.json"))
}
