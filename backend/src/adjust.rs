use image::{DynamicImage, GenericImageView, RgbaImage};

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

// --- Pure in-memory image-processing functions ---

/// Apply a luminance curve LUT to an RGBA image in-place.
pub fn apply_luminance_curve_to_image(mut rgba: RgbaImage, lut: &[u8]) -> RgbaImage {
	for pixel in rgba.pixels_mut() {
		pixel[0] = lut[pixel[0] as usize];
		pixel[1] = lut[pixel[1] as usize];
		pixel[2] = lut[pixel[2] as usize];
	}
	rgba
}

/// Shift hue of an RGBA image by `offset` degrees.
pub fn apply_hue_to_image(mut rgba: RgbaImage, offset: f32) -> RgbaImage {
	for pixel in rgba.pixels_mut() {
		let (h, s, l) = rgb_to_hsl(pixel[0], pixel[1], pixel[2]);
		let new_h = (h + offset).rem_euclid(360.0);
		let (r, g, b) = hsl_to_rgb(new_h, s, l);
		pixel[0] = r;
		pixel[1] = g;
		pixel[2] = b;
	}
	rgba
}

/// Scale saturation of an RGBA image by `offset` in [-1, 1].
pub fn apply_saturation_to_image(mut rgba: RgbaImage, offset: f32) -> RgbaImage {
	for pixel in rgba.pixels_mut() {
		let (h, s, l) = rgb_to_hsl(pixel[0], pixel[1], pixel[2]);
		let new_s = (s + offset * s.max(1.0 - s)).clamp(0.0, 1.0);
		let (r, g, b) = hsl_to_rgb(h, new_s, l);
		pixel[0] = r;
		pixel[1] = g;
		pixel[2] = b;
	}
	rgba
}

// --- Tauri commands (thin wrappers) ---

#[tauri::command]
pub async fn apply_luminance_curve(
	path: String,
	lut: Vec<u8>,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	if lut.len() != 256 {
		return Err(format!("LUT must have exactly 256 entries, got {}", lut.len()));
	}
	tokio::task::spawn_blocking(move || {
		let img = maybe_resize(load_dynamic_image(&path)?, max_preview_size);
		let rgba = apply_luminance_curve_to_image(img.to_rgba8(), &lut);
		encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn adjust_hue(
	path: String,
	offset: f32,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || {
		let img = maybe_resize(load_dynamic_image(&path)?, max_preview_size);
		let rgba = apply_hue_to_image(img.to_rgba8(), offset);
		encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn adjust_saturation(
	path: String,
	offset: f32,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || {
		let img = maybe_resize(load_dynamic_image(&path)?, max_preview_size);
		let rgba = apply_saturation_to_image(img.to_rgba8(), offset);
		encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

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
		let img = load_dynamic_image(&path)?;
		let rgba = img.to_rgba8();

		let result = match operation.as_str() {
			"luminance-curve" => {
				let lut = lut.ok_or("LUT required for luminance-curve")?;
				apply_luminance_curve_to_image(rgba, &lut)
			}
			"adjust-hue" => apply_hue_to_image(rgba, hue_offset.unwrap_or(0.0)),
			"adjust-saturation" => apply_saturation_to_image(rgba, saturation_offset.unwrap_or(0.0)),
			_ => return Err(format!("Unknown adjust operation: {}", operation)),
		};

		save_image(&DynamicImage::ImageRgba8(result), &output_path, &format)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

// --- HSL conversion utilities ---

pub fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
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

pub fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (u8, u8, u8) {
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
