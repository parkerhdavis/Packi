use image::{DynamicImage, GenericImageView};

use crate::image_io::{encode_to_base64_png, load_dynamic_image, save_image};

/// Optionally downscale an image to fit within `max_size` on its longest axis.
fn maybe_resize(img: DynamicImage, max_size: Option<u32>) -> DynamicImage {
	if let Some(max_size) = max_size {
		let (w, h) = img.dimensions();
		if w > max_size || h > max_size {
			img.resize(max_size, max_size, image::imageops::FilterType::Lanczos3)
		} else {
			img
		}
	} else {
		img
	}
}

/// Apply a luminance curve LUT to an image.
/// The `lut` is a 256-entry array mapping input [0-255] → output [0-255].
/// Applied to R, G, B channels independently (luminance-style curve).
#[tauri::command]
pub async fn apply_luminance_curve(
	path: String,
	lut: Vec<u8>,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	if lut.len() != 256 {
		return Err(format!("LUT must have exactly 256 entries, got {}", lut.len()));
	}
	tokio::task::spawn_blocking(move || apply_luminance_curve_sync(&path, &lut, max_preview_size))
		.await
		.map_err(|e| format!("Task failed: {}", e))?
}

fn apply_luminance_curve_sync(
	path: &str,
	lut: &[u8],
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	let img = maybe_resize(load_dynamic_image(path)?, max_preview_size);
	let mut rgba = img.to_rgba8();

	for pixel in rgba.pixels_mut() {
		pixel[0] = lut[pixel[0] as usize];
		pixel[1] = lut[pixel[1] as usize];
		pixel[2] = lut[pixel[2] as usize];
		// Alpha unchanged
	}

	encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
}

/// Adjust the hue of an image.
/// `offset` is in degrees, range [-180, 180].
#[tauri::command]
pub async fn adjust_hue(
	path: String,
	offset: f32,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || adjust_hue_sync(&path, offset, max_preview_size))
		.await
		.map_err(|e| format!("Task failed: {}", e))?
}

fn adjust_hue_sync(
	path: &str,
	offset: f32,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	let img = maybe_resize(load_dynamic_image(path)?, max_preview_size);
	let mut rgba = img.to_rgba8();

	for pixel in rgba.pixels_mut() {
		let (h, s, l) = rgb_to_hsl(pixel[0], pixel[1], pixel[2]);
		let new_h = (h + offset).rem_euclid(360.0);
		let (r, g, b) = hsl_to_rgb(new_h, s, l);
		pixel[0] = r;
		pixel[1] = g;
		pixel[2] = b;
	}

	encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
}

/// Adjust the saturation of an image.
/// `offset` is in range [-1, 1], where -1 = fully desaturated, 0 = no change, 1 = double saturation.
#[tauri::command]
pub async fn adjust_saturation(
	path: String,
	offset: f32,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || adjust_saturation_sync(&path, offset, max_preview_size))
		.await
		.map_err(|e| format!("Task failed: {}", e))?
}

fn adjust_saturation_sync(
	path: &str,
	offset: f32,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	let img = maybe_resize(load_dynamic_image(path)?, max_preview_size);
	let mut rgba = img.to_rgba8();

	for pixel in rgba.pixels_mut() {
		let (h, s, l) = rgb_to_hsl(pixel[0], pixel[1], pixel[2]);
		// offset of -1 brings saturation to 0, offset of 1 doubles it (clamped)
		let new_s = (s + offset * s.max(1.0 - s)).clamp(0.0, 1.0);
		let (r, g, b) = hsl_to_rgb(h, new_s, l);
		pixel[0] = r;
		pixel[1] = g;
		pixel[2] = b;
	}

	encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
}

/// Export an adjust operation result to disk (always full resolution).
#[tauri::command]
pub async fn export_adjust_result(
	operation: String,
	path: String,
	output_path: String,
	format: String,
	lut: Option<Vec<u8>>,
	hue_offset: Option<f32>,
	saturation_offset: Option<f32>,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		let result_base64 = match operation.as_str() {
			"luminance-curve" => {
				let lut = lut.ok_or("LUT required for luminance-curve")?;
				apply_luminance_curve_sync(&path, &lut, None)?
			}
			"adjust-hue" => {
				adjust_hue_sync(&path, hue_offset.unwrap_or(0.0), None)?
			}
			"adjust-saturation" => {
				adjust_saturation_sync(&path, saturation_offset.unwrap_or(0.0), None)?
			}
			_ => return Err(format!("Unknown adjust operation: {}", operation)),
		};

		use base64::Engine;
		let bytes = base64::engine::general_purpose::STANDARD
			.decode(&result_base64)
			.map_err(|e| format!("Failed to decode result: {}", e))?;

		let img = image::load_from_memory(&bytes)
			.map_err(|e| format!("Failed to load result image: {}", e))?;

		save_image(&img, &output_path, &format, 8)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

// --- HSL conversion utilities ---

/// Convert RGB (0-255 each) to HSL (H: 0-360, S: 0-1, L: 0-1).
fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
	let r = r as f32 / 255.0;
	let g = g as f32 / 255.0;
	let b = b as f32 / 255.0;

	let max = r.max(g).max(b);
	let min = r.min(g).min(b);
	let l = (max + min) / 2.0;

	if (max - min).abs() < 1e-6 {
		return (0.0, 0.0, l);
	}

	let d = max - min;
	let s = if l > 0.5 {
		d / (2.0 - max - min)
	} else {
		d / (max + min)
	};

	let h = if (max - r).abs() < 1e-6 {
		let mut h = (g - b) / d;
		if g < b {
			h += 6.0;
		}
		h
	} else if (max - g).abs() < 1e-6 {
		(b - r) / d + 2.0
	} else {
		(r - g) / d + 4.0
	};

	(h * 60.0, s, l)
}

/// Convert HSL (H: 0-360, S: 0-1, L: 0-1) to RGB (0-255 each).
fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (u8, u8, u8) {
	if s.abs() < 1e-6 {
		let v = (l * 255.0).round() as u8;
		return (v, v, v);
	}

	let q = if l < 0.5 {
		l * (1.0 + s)
	} else {
		l + s - l * s
	};
	let p = 2.0 * l - q;
	let h = h / 360.0;

	let r = hue_to_rgb(p, q, h + 1.0 / 3.0);
	let g = hue_to_rgb(p, q, h);
	let b = hue_to_rgb(p, q, h - 1.0 / 3.0);

	(
		(r * 255.0).round() as u8,
		(g * 255.0).round() as u8,
		(b * 255.0).round() as u8,
	)
}

fn hue_to_rgb(p: f32, q: f32, mut t: f32) -> f32 {
	if t < 0.0 {
		t += 1.0;
	}
	if t > 1.0 {
		t -= 1.0;
	}
	if t < 1.0 / 6.0 {
		return p + (q - p) * 6.0 * t;
	}
	if t < 1.0 / 2.0 {
		return q;
	}
	if t < 2.0 / 3.0 {
		return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
	}
	p
}
