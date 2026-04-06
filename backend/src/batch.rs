use image::imageops::FilterType;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::Emitter;

use crate::image_io::{load_dynamic_image, save_image};
use crate::normal_map::{flip_green_on_image, normalize_on_image};
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
	#[serde(rename = "flip-green")]
	FlipGreen,
	#[serde(rename = "normalize")]
	Normalize,
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
				BatchStep::Resize { .. }
				| BatchStep::FlipGreen
				| BatchStep::Normalize => {
					// These don't change the filename
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
pub async fn run_batch(
	files: Vec<String>,
	pipeline: BatchPipeline,
	output_dir: String,
	app_handle: tauri::AppHandle,
) -> Result<BatchResult, String> {
	tokio::task::spawn_blocking(move || {
		run_batch_sync(files, pipeline, output_dir, app_handle)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

fn run_batch_sync(
	files: Vec<String>,
	pipeline: BatchPipeline,
	output_dir: String,
	app_handle: tauri::AppHandle,
) -> Result<BatchResult, String> {
	// Create output directory
	fs::create_dir_all(&output_dir)
		.map_err(|e| format!("Failed to create output directory: {}", e))?;

	let total = files.len();
	let completed = AtomicUsize::new(0);

	let results: Vec<Result<(), BatchFailure>> = files
		.par_iter()
		.enumerate()
		.map(|(idx, file_path)| {
			let result = process_single_file(file_path, &pipeline, &output_dir, idx);
			let done = completed.fetch_add(1, Ordering::Relaxed) + 1;
			let _ = app_handle.emit("batch-progress", serde_json::json!({
				"current": done,
				"total": total,
				"current_file": file_path,
			}));
			result.map_err(|e| BatchFailure {
				path: file_path.clone(),
				error: e,
			})
		})
		.collect();

	let mut processed = 0usize;
	let mut failed = Vec::new();
	for r in results {
		match r {
			Ok(()) => processed += 1,
			Err(f) => failed.push(f),
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
	let mut output_ext = ext.to_string();
	let mut save_format = ext.to_string();

	for step in &pipeline.steps {
		match step {
			BatchStep::Convert { format, .. } => {
				output_ext = format_to_extension(format);
				save_format = format.clone();
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
				output_name = apply_rename_pattern(pattern, stem, &output_ext, idx);
			}
			BatchStep::FlipGreen => {
				let rgba = img.to_rgba8();
				img = image::DynamicImage::ImageRgba8(flip_green_on_image(rgba));
			}
			BatchStep::Normalize => {
				let rgba = img.to_rgba8();
				img = image::DynamicImage::ImageRgba8(normalize_on_image(rgba));
			}
		}
	}

	let output_path = Path::new(output_dir).join(format!("{}.{}", output_name, output_ext));
	let output_str = output_path
		.to_str()
		.ok_or_else(|| format!("Output path contains invalid UTF-8: {:?}", output_path))?;
	save_image(&img, output_str, &save_format)
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

	let supported = ["png", "tga", "jpg", "jpeg", "tif", "tiff", "bmp", "exr"];
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

#[cfg(test)]
mod tests {
	use super::*;

	// --- format_to_extension ---

	#[test]
	fn format_to_extension_png8() {
		assert_eq!(format_to_extension("png8"), "png");
	}

	#[test]
	fn format_to_extension_png16() {
		assert_eq!(format_to_extension("png16"), "png");
	}

	#[test]
	fn format_to_extension_tga() {
		assert_eq!(format_to_extension("tga"), "tga");
	}

	#[test]
	fn format_to_extension_jpeg() {
		assert_eq!(format_to_extension("jpeg"), "jpg");
	}

	#[test]
	fn format_to_extension_exr() {
		assert_eq!(format_to_extension("exr"), "exr");
	}

	#[test]
	fn format_to_extension_unknown_passthrough() {
		assert_eq!(format_to_extension("bmp"), "bmp");
	}

	// --- apply_rename_pattern ---

	#[test]
	fn rename_pattern_with_name() {
		assert_eq!(
			apply_rename_pattern("{name}_output", "texture", "png", 0),
			"texture_output"
		);
	}

	#[test]
	fn rename_pattern_with_ext() {
		assert_eq!(
			apply_rename_pattern("{name}.{ext}", "texture", "tga", 0),
			"texture.tga"
		);
	}

	#[test]
	fn rename_pattern_with_index() {
		assert_eq!(
			apply_rename_pattern("file_{index}", "texture", "png", 5),
			"file_0005"
		);
	}

	#[test]
	fn rename_pattern_all_placeholders() {
		assert_eq!(
			apply_rename_pattern("{name}_{index}.{ext}", "rock", "jpg", 42),
			"rock_0042.jpg"
		);
	}

	#[test]
	fn rename_pattern_no_placeholders() {
		assert_eq!(
			apply_rename_pattern("constant_name", "anything", "png", 0),
			"constant_name"
		);
	}

	// --- nearest_pot ---

	#[test]
	fn nearest_pot_zero() {
		assert_eq!(nearest_pot(0), 1);
	}

	#[test]
	fn nearest_pot_exact_power() {
		assert_eq!(nearest_pot(256), 256);
		assert_eq!(nearest_pot(1024), 1024);
		assert_eq!(nearest_pot(1), 1);
	}

	#[test]
	fn nearest_pot_rounds_down() {
		// 300 is closer to 256 than 512
		assert_eq!(nearest_pot(300), 256);
	}

	#[test]
	fn nearest_pot_rounds_up() {
		// 400 is closer to 512 than 256
		assert_eq!(nearest_pot(400), 512);
	}

	#[test]
	fn nearest_pot_midpoint() {
		// 384 is equidistant between 256 and 512 → rounds up
		assert_eq!(nearest_pot(384), 512);
	}

	// --- preview_batch ---

	#[test]
	fn preview_batch_no_steps() {
		let files = vec!["/path/to/texture.png".to_string()];
		let pipeline = BatchPipeline { steps: vec![] };
		let result = preview_batch(files, pipeline).unwrap();
		assert_eq!(result.len(), 1);
		assert_eq!(result[0].output_filename, "texture.png");
	}

	#[test]
	fn preview_batch_convert_step() {
		let files = vec!["/path/to/texture.png".to_string()];
		let pipeline = BatchPipeline {
			steps: vec![BatchStep::Convert {
				format: "tga".to_string(),
				bit_depth: 8,
			}],
		};
		let result = preview_batch(files, pipeline).unwrap();
		assert_eq!(result[0].output_filename, "texture.tga");
		assert_eq!(result[0].output_format, "TGA");
	}

	#[test]
	fn preview_batch_rename_step() {
		let files = vec!["/path/to/texture.png".to_string()];
		let pipeline = BatchPipeline {
			steps: vec![BatchStep::Rename {
				pattern: "{name}_processed".to_string(),
			}],
		};
		let result = preview_batch(files, pipeline).unwrap();
		assert_eq!(result[0].output_filename, "texture_processed.png");
	}

	#[test]
	fn preview_batch_convert_then_rename() {
		let files = vec!["/path/to/texture.png".to_string()];
		let pipeline = BatchPipeline {
			steps: vec![
				BatchStep::Convert {
					format: "jpeg".to_string(),
					bit_depth: 8,
				},
				BatchStep::Rename {
					pattern: "{name}_out".to_string(),
				},
			],
		};
		let result = preview_batch(files, pipeline).unwrap();
		assert_eq!(result[0].output_filename, "texture_out.jpg");
	}

	#[test]
	fn preview_batch_multiple_files() {
		let files = vec![
			"/a/one.png".to_string(),
			"/b/two.tga".to_string(),
		];
		let pipeline = BatchPipeline {
			steps: vec![BatchStep::Rename {
				pattern: "batch_{index}".to_string(),
			}],
		};
		let result = preview_batch(files, pipeline).unwrap();
		assert_eq!(result[0].output_filename, "batch_0000.png");
		assert_eq!(result[1].output_filename, "batch_0001.tga");
	}

	// --- process_single_file (integration tests with temp files) ---

	#[test]
	fn process_single_file_convert_png_to_tga() {
		let tmp_dir = tempfile::tempdir().unwrap();
		let input_path = tmp_dir.path().join("input.png");
		let output_dir = tmp_dir.path().join("output");
		fs::create_dir_all(&output_dir).unwrap();

		// Create a small test image
		let img = image::RgbaImage::new(4, 4);
		img.save(&input_path).unwrap();

		let pipeline = BatchPipeline {
			steps: vec![BatchStep::Convert {
				format: "tga".to_string(),
				bit_depth: 8,
			}],
		};

		process_single_file(
			input_path.to_str().unwrap(),
			&pipeline,
			output_dir.to_str().unwrap(),
			0,
		)
		.unwrap();

		let output_file = output_dir.join("input.tga");
		assert!(output_file.exists(), "output TGA file should exist");
	}

	#[test]
	fn process_single_file_resize() {
		let tmp_dir = tempfile::tempdir().unwrap();
		let input_path = tmp_dir.path().join("input.png");
		let output_dir = tmp_dir.path().join("output");
		fs::create_dir_all(&output_dir).unwrap();

		// Create a 16×16 test image
		let img = image::RgbaImage::new(16, 16);
		img.save(&input_path).unwrap();

		let pipeline = BatchPipeline {
			steps: vec![BatchStep::Resize {
				mode: "exact".to_string(),
				width: 8,
				height: 8,
				filter: "lanczos".to_string(),
			}],
		};

		process_single_file(
			input_path.to_str().unwrap(),
			&pipeline,
			output_dir.to_str().unwrap(),
			0,
		)
		.unwrap();

		let output_file = output_dir.join("input.png");
		assert!(output_file.exists());

		// Verify dimensions
		let loaded = image::open(&output_file).unwrap();
		assert_eq!(image::GenericImageView::dimensions(&loaded), (8, 8));
	}

	#[test]
	fn process_single_file_flip_green() {
		let tmp_dir = tempfile::tempdir().unwrap();
		let input_path = tmp_dir.path().join("normal.png");
		let output_dir = tmp_dir.path().join("output");
		fs::create_dir_all(&output_dir).unwrap();

		// Create a 4×4 image with known green channel value
		let mut img = image::RgbaImage::new(4, 4);
		for pixel in img.pixels_mut() {
			*pixel = image::Rgba([128, 200, 255, 255]);
		}
		img.save(&input_path).unwrap();

		let pipeline = BatchPipeline {
			steps: vec![BatchStep::FlipGreen],
		};

		process_single_file(
			input_path.to_str().unwrap(),
			&pipeline,
			output_dir.to_str().unwrap(),
			0,
		)
		.unwrap();

		let output_file = output_dir.join("normal.png");
		let loaded = image::open(&output_file).unwrap().to_rgba8();
		let p = loaded.get_pixel(0, 0);
		assert_eq!(p[0], 128, "red unchanged");
		assert_eq!(p[1], 55, "green flipped: 255 - 200 = 55");
		assert_eq!(p[2], 255, "blue unchanged");
	}

	#[test]
	fn process_single_file_normalize() {
		let tmp_dir = tempfile::tempdir().unwrap();
		let input_path = tmp_dir.path().join("normal.png");
		let output_dir = tmp_dir.path().join("output");
		fs::create_dir_all(&output_dir).unwrap();

		let mut img = image::RgbaImage::new(4, 4);
		for pixel in img.pixels_mut() {
			*pixel = image::Rgba([128, 128, 255, 255]);
		}
		img.save(&input_path).unwrap();

		let pipeline = BatchPipeline {
			steps: vec![BatchStep::Normalize],
		};

		process_single_file(
			input_path.to_str().unwrap(),
			&pipeline,
			output_dir.to_str().unwrap(),
			0,
		)
		.unwrap();

		let output_file = output_dir.join("normal.png");
		assert!(output_file.exists());
	}

	#[test]
	fn preview_batch_flip_green_preserves_filename() {
		let files = vec!["/path/to/texture.png".to_string()];
		let pipeline = BatchPipeline {
			steps: vec![BatchStep::FlipGreen],
		};
		let result = preview_batch(files, pipeline).unwrap();
		assert_eq!(result[0].output_filename, "texture.png");
	}
}
