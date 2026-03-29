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
	#[serde(default)]
	pub r_invert: bool,
	#[serde(default)]
	pub g_invert: bool,
	#[serde(default)]
	pub b_invert: bool,
	#[serde(default)]
	pub a_invert: bool,
}

/// Return built-in packing presets.
#[tauri::command]
pub fn get_builtin_presets() -> Vec<PackingPreset> {
	vec![
		PackingPreset {
			name: "Unreal / Godot \u{2014} ORM".to_string(),
			description: "AO, Roughness, Metallic (glTF standard)".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "AO".to_string(),
				g: "Roughness".to_string(),
				b: "Metallic".to_string(),
				a: "".to_string(),
				r_invert: false,
				g_invert: false,
				b_invert: false,
				a_invert: false,
			},
		},
		PackingPreset {
			name: "RMA".to_string(),
			description: "Roughness, Metallic, AO".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "Roughness".to_string(),
				g: "Metallic".to_string(),
				b: "AO".to_string(),
				a: "".to_string(),
				r_invert: false,
				g_invert: false,
				b_invert: false,
				a_invert: false,
			},
		},
		PackingPreset {
			name: "Unity HDRP \u{2014} Mask Map (MADS)".to_string(),
			description: "Metallic, AO, Detail Mask, Smoothness".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "Metallic".to_string(),
				g: "AO".to_string(),
				b: "Detail Mask".to_string(),
				a: "Smoothness".to_string(),
				r_invert: false,
				g_invert: false,
				b_invert: false,
				a_invert: true,
			},
		},
		PackingPreset {
			name: "Unity URP \u{2014} Metallic + Smoothness".to_string(),
			description: "Metallic (grayscale RGB), Smoothness".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "Metallic".to_string(),
				g: "Metallic".to_string(),
				b: "Metallic".to_string(),
				a: "Smoothness".to_string(),
				r_invert: false,
				g_invert: false,
				b_invert: false,
				a_invert: true,
			},
		},
		PackingPreset {
			name: "ORMA".to_string(),
			description: "ORM + Alpha for height or opacity".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "AO".to_string(),
				g: "Roughness".to_string(),
				b: "Metallic".to_string(),
				a: "Height / Opacity".to_string(),
				r_invert: false,
				g_invert: false,
				b_invert: false,
				a_invert: false,
			},
		},
		PackingPreset {
			name: "RMAA".to_string(),
			description: "RMA + Alpha for height or opacity".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "Roughness".to_string(),
				g: "Metallic".to_string(),
				b: "AO".to_string(),
				a: "Height / Opacity".to_string(),
				r_invert: false,
				g_invert: false,
				b_invert: false,
				a_invert: false,
			},
		},
		PackingPreset {
			name: "Albedo + Alpha".to_string(),
			description: "Base color with transparency".to_string(),
			builtin: true,
			labels: ChannelLabels {
				r: "Base Color R".to_string(),
				g: "Base Color G".to_string(),
				b: "Base Color B".to_string(),
				a: "Opacity".to_string(),
				r_invert: false,
				g_invert: false,
				b_invert: false,
				a_invert: false,
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
