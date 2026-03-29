use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Emitter;

use crate::image_io::{load_dynamic_image, save_image};
use crate::settings::atomic_write;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum BatchStep {
	#[serde(rename = "convert")]
	Convert { format: String, bit_depth: u8 },
	#[serde(rename = "resize")]
	Resize {
		mode: String,
		width: u32,
		height: u32,
		filter: String,
	},
	#[serde(rename = "rename")]
	Rename { pattern: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchPipeline {
	pub steps: Vec<BatchStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchPreviewItem {
	pub input_path: String,
	pub output_filename: String,
	pub output_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
	pub processed: usize,
	pub failed: Vec<BatchFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchFailure {
	pub path: String,
	pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamedPipeline {
	pub name: String,
	pub steps: Vec<BatchStep>,
}

/// Preview what the batch pipeline would produce without executing.
#[tauri::command]
pub fn preview_batch(files: Vec<String>, pipeline: BatchPipeline) -> Result<Vec<BatchPreviewItem>, String> {
	let mut items = Vec::new();

	for (idx, file_path) in files.iter().enumerate() {
		let path = Path::new(file_path);
		let stem = path
			.file_stem()
			.and_then(|s| s.to_str())
			.unwrap_or("file");
		let ext = path
			.extension()
			.and_then(|s| s.to_str())
			.unwrap_or("png");

		let mut output_name = stem.to_string();
		let mut output_format = ext.to_string();

		for step in &pipeline.steps {
			match step {
				BatchStep::Convert { format, .. } => {
					output_format = format_to_extension(format);
				}
				BatchStep::Resize { .. } => {
					// Resize doesn't change the filename
				}
				BatchStep::Rename { pattern } => {
					output_name = apply_rename_pattern(pattern, stem, &output_format, idx);
				}
			}
		}

		items.push(BatchPreviewItem {
			input_path: file_path.clone(),
			output_filename: format!("{}.{}", output_name, output_format),
			output_format: output_format.to_uppercase(),
		});
	}

	Ok(items)
}

/// Execute the batch pipeline on all files.
#[tauri::command]
pub fn run_batch(
	files: Vec<String>,
	pipeline: BatchPipeline,
	output_dir: String,
	app_handle: tauri::AppHandle,
) -> Result<BatchResult, String> {
	// Create output directory
	fs::create_dir_all(&output_dir)
		.map_err(|e| format!("Failed to create output directory: {}", e))?;

	let total = files.len();
	let mut processed = 0usize;
	let mut failed = Vec::new();

	for (idx, file_path) in files.iter().enumerate() {
		// Emit progress
		let _ = app_handle.emit("batch-progress", serde_json::json!({
			"current": idx,
			"total": total,
			"current_file": file_path,
		}));

		match process_single_file(file_path, &pipeline, &output_dir, idx) {
			Ok(()) => processed += 1,
			Err(e) => failed.push(BatchFailure {
				path: file_path.clone(),
				error: e,
			}),
		}
	}

	// Emit completion
	let _ = app_handle.emit("batch-progress", serde_json::json!({
		"current": total,
		"total": total,
		"current_file": "",
	}));

	Ok(BatchResult { processed, failed })
}

fn process_single_file(
	file_path: &str,
	pipeline: &BatchPipeline,
	output_dir: &str,
	idx: usize,
) -> Result<(), String> {
	let path = Path::new(file_path);
	let stem = path
		.file_stem()
		.and_then(|s| s.to_str())
		.unwrap_or("file");
	let ext = path
		.extension()
		.and_then(|s| s.to_str())
		.unwrap_or("png");

	let mut img = load_dynamic_image(file_path)?;
	let mut output_name = stem.to_string();
	let mut output_format = ext.to_string();
	let mut bit_depth = 8u8;

	for step in &pipeline.steps {
		match step {
			BatchStep::Convert { format, bit_depth: bd } => {
				output_format = format_to_extension(format);
				bit_depth = *bd;
			}
			BatchStep::Resize { mode, width, height, filter } => {
				let filter_type = match filter.as_str() {
					"lanczos" => FilterType::Lanczos3,
					"bilinear" => FilterType::Triangle,
					"nearest" => FilterType::Nearest,
					_ => FilterType::Lanczos3,
				};

				let (cur_w, cur_h) = image::GenericImageView::dimensions(&img);

				let (new_w, new_h) = match mode.as_str() {
					"exact" => (*width, *height),
					"scale" => {
						let scale = *width as f32 / 100.0;
						((cur_w as f32 * scale).round() as u32, (cur_h as f32 * scale).round() as u32)
					}
					"nearest-pot" => (nearest_pot(cur_w), nearest_pot(cur_h)),
					_ => (*width, *height),
				};

				if new_w > 0 && new_h > 0 {
					img = img.resize_exact(new_w, new_h, filter_type);
				}
			}
			BatchStep::Rename { pattern } => {
				output_name = apply_rename_pattern(pattern, stem, &output_format, idx);
			}
		}
	}

	let output_path = Path::new(output_dir).join(format!("{}.{}", output_name, output_format));
	save_image(&img, output_path.to_str().unwrap_or(""), &output_format, bit_depth)
}

fn format_to_extension(format: &str) -> String {
	match format {
		"png8" | "png16" => "png".to_string(),
		"tga" => "tga".to_string(),
		"jpeg" => "jpg".to_string(),
		"exr" => "exr".to_string(),
		other => other.to_string(),
	}
}

fn apply_rename_pattern(pattern: &str, name: &str, ext: &str, index: usize) -> String {
	pattern
		.replace("{name}", name)
		.replace("{ext}", ext)
		.replace("{index}", &format!("{:04}", index))
}

fn nearest_pot(v: u32) -> u32 {
	if v == 0 { return 1; }
	let lower = 1u32 << (31 - v.leading_zeros());
	let upper = lower << 1;
	if v - lower < upper - v { lower } else { upper }
}

/// List supported image files in a directory.
#[tauri::command]
pub fn list_image_files(dir: String) -> Result<Vec<String>, String> {
	let path = Path::new(&dir);
	if !path.is_dir() {
		return Err(format!("Not a directory: {}", dir));
	}

	let supported = ["png", "tga", "jpg", "jpeg", "tif", "tiff", "bmp"];
	let mut files = Vec::new();

	collect_image_files(path, &supported, &mut files)?;
	files.sort();
	Ok(files)
}

fn collect_image_files(dir: &Path, extensions: &[&str], results: &mut Vec<String>) -> Result<(), String> {
	let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;
	for entry in entries {
		let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
		let path = entry.path();
		if path.is_dir() {
			collect_image_files(&path, extensions, results)?;
		} else if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
			if extensions.iter().any(|e| e.eq_ignore_ascii_case(ext)) {
				if let Some(p) = path.to_str() {
					results.push(p.to_string());
				}
			}
		}
	}
	Ok(())
}

/// Save a pipeline preset.
#[tauri::command]
pub fn save_pipeline_preset(name: String, steps: Vec<BatchStep>) -> Result<(), String> {
	let mut presets = load_pipeline_presets().unwrap_or_default();

	if let Some(idx) = presets.iter().position(|p| p.name == name) {
		presets[idx].steps = steps;
	} else {
		presets.push(NamedPipeline { name, steps });
	}

	let path = pipelines_path()?;
	let content = serde_json::to_string_pretty(&presets)
		.map_err(|e| format!("Failed to serialize pipeline presets: {}", e))?;
	atomic_write(&path, &content)?;
	Ok(())
}

/// Load saved pipeline presets.
#[tauri::command]
pub fn load_pipeline_presets() -> Result<Vec<NamedPipeline>, String> {
	let path = pipelines_path()?;
	if !path.exists() {
		return Ok(Vec::new());
	}
	let content =
		fs::read_to_string(&path).map_err(|e| format!("Failed to read pipeline presets: {}", e))?;
	serde_json::from_str(&content).map_err(|e| format!("Failed to parse pipeline presets: {}", e))
}

/// Delete a pipeline preset by name.
#[tauri::command]
pub fn delete_pipeline_preset(name: String) -> Result<(), String> {
	let mut presets = load_pipeline_presets().unwrap_or_default();
	presets.retain(|p| p.name != name);

	let path = pipelines_path()?;
	let content = serde_json::to_string_pretty(&presets)
		.map_err(|e| format!("Failed to serialize pipeline presets: {}", e))?;
	atomic_write(&path, &content)?;
	Ok(())
}

fn pipelines_path() -> Result<std::path::PathBuf, String> {
	let config_dir =
		dirs::config_dir().ok_or_else(|| "Could not determine config directory".to_string())?;
	let app_dir = config_dir.join("packi");
	if !app_dir.exists() {
		fs::create_dir_all(&app_dir)
			.map_err(|e| format!("Failed to create config directory: {}", e))?;
	}
	Ok(app_dir.join("pipelines.json"))
}
