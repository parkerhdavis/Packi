use image::{DynamicImage, RgbaImage};

use crate::image_io::{encode_to_base64_png, load_dynamic_image, maybe_resize, save_image};

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

#[cfg(test)]
mod tests {
	use super::*;
	use image::RgbaImage;

	/// Create a 2×2 RGBA test image with known pixel values.
	fn make_test_image() -> RgbaImage {
		let mut img = RgbaImage::new(2, 2);
		img.put_pixel(0, 0, image::Rgba([255, 0, 0, 255]));     // red
		img.put_pixel(1, 0, image::Rgba([0, 255, 0, 255]));     // green
		img.put_pixel(0, 1, image::Rgba([0, 0, 255, 255]));     // blue
		img.put_pixel(1, 1, image::Rgba([128, 128, 128, 255])); // gray
		img
	}

	// --- HSL round-trip tests ---

	#[test]
	fn hsl_roundtrip_pure_red() {
		let (h, s, l) = rgb_to_hsl(255, 0, 0);
		let (r, g, b) = hsl_to_rgb(h, s, l);
		assert_eq!((r, g, b), (255, 0, 0));
	}

	#[test]
	fn hsl_roundtrip_pure_green() {
		let (h, s, l) = rgb_to_hsl(0, 255, 0);
		let (r, g, b) = hsl_to_rgb(h, s, l);
		assert_eq!((r, g, b), (0, 255, 0));
	}

	#[test]
	fn hsl_roundtrip_pure_blue() {
		let (h, s, l) = rgb_to_hsl(0, 0, 255);
		let (r, g, b) = hsl_to_rgb(h, s, l);
		assert_eq!((r, g, b), (0, 0, 255));
	}

	#[test]
	fn hsl_roundtrip_white() {
		let (h, s, l) = rgb_to_hsl(255, 255, 255);
		assert!(s < 1e-4, "white should have zero saturation");
		let (r, g, b) = hsl_to_rgb(h, s, l);
		assert_eq!((r, g, b), (255, 255, 255));
	}

	#[test]
	fn hsl_roundtrip_black() {
		let (h, s, l) = rgb_to_hsl(0, 0, 0);
		assert!(l < 1e-4, "black should have zero lightness");
		let (r, g, b) = hsl_to_rgb(h, s, l);
		assert_eq!((r, g, b), (0, 0, 0));
	}

	#[test]
	fn hsl_roundtrip_midtone() {
		let (h, s, l) = rgb_to_hsl(100, 150, 200);
		let (r, g, b) = hsl_to_rgb(h, s, l);
		// Allow ±1 for float rounding
		assert!((r as i16 - 100).abs() <= 1);
		assert!((g as i16 - 150).abs() <= 1);
		assert!((b as i16 - 200).abs() <= 1);
	}

	// --- Luminance curve tests ---

	#[test]
	fn luminance_curve_identity() {
		let img = make_test_image();
		let identity_lut: Vec<u8> = (0..=255).collect();
		let result = apply_luminance_curve_to_image(img.clone(), &identity_lut);
		assert_eq!(result, img, "identity LUT should not change the image");
	}

	#[test]
	fn luminance_curve_invert() {
		let img = make_test_image();
		let invert_lut: Vec<u8> = (0..=255).rev().collect();
		let result = apply_luminance_curve_to_image(img, &invert_lut);
		// Red pixel (255,0,0) → (0,255,255)
		let p = result.get_pixel(0, 0);
		assert_eq!(p[0], 0);
		assert_eq!(p[1], 255);
		assert_eq!(p[2], 255);
		assert_eq!(p[3], 255); // alpha unchanged
	}

	#[test]
	fn luminance_curve_preserves_alpha() {
		let mut img = RgbaImage::new(1, 1);
		img.put_pixel(0, 0, image::Rgba([100, 100, 100, 42]));
		let identity_lut: Vec<u8> = (0..=255).collect();
		let result = apply_luminance_curve_to_image(img, &identity_lut);
		assert_eq!(result.get_pixel(0, 0)[3], 42);
	}

	// --- Hue adjustment tests ---

	#[test]
	fn hue_zero_offset_is_noop() {
		let img = make_test_image();
		let result = apply_hue_to_image(img.clone(), 0.0);
		// Gray pixel should be unchanged (no hue to shift)
		assert_eq!(result.get_pixel(1, 1), img.get_pixel(1, 1));
	}

	#[test]
	fn hue_full_rotation_returns_original() {
		let img = make_test_image();
		let result = apply_hue_to_image(img.clone(), 360.0);
		// Each pixel should match within ±1 due to float rounding
		for (x, y, original) in img.enumerate_pixels() {
			let shifted = result.get_pixel(x, y);
			for ch in 0..3 {
				assert!(
					(original[ch] as i16 - shifted[ch] as i16).abs() <= 1,
					"pixel ({},{}) channel {} differs: {} vs {}",
					x, y, ch, original[ch], shifted[ch]
				);
			}
		}
	}

	#[test]
	fn hue_preserves_alpha() {
		let mut img = RgbaImage::new(1, 1);
		img.put_pixel(0, 0, image::Rgba([255, 0, 0, 42]));
		let result = apply_hue_to_image(img, 90.0);
		assert_eq!(result.get_pixel(0, 0)[3], 42);
	}

	// --- Saturation adjustment tests ---

	#[test]
	fn saturation_zero_offset_is_noop() {
		let img = make_test_image();
		let result = apply_saturation_to_image(img.clone(), 0.0);
		assert_eq!(result, img);
	}

	#[test]
	fn saturation_negative_desaturates() {
		// A saturated color should move toward gray when offset is negative
		let mut img = RgbaImage::new(1, 1);
		img.put_pixel(0, 0, image::Rgba([255, 0, 0, 255])); // pure red
		let result = apply_saturation_to_image(img, -0.5);
		let p = result.get_pixel(0, 0);
		// Should be less saturated: R should decrease, G/B should increase
		assert!(p[0] < 255, "R should decrease");
		assert!(p[1] > 0, "G should increase toward gray");
		assert!(p[2] > 0, "B should increase toward gray");
	}

	#[test]
	fn saturation_preserves_alpha() {
		let mut img = RgbaImage::new(1, 1);
		img.put_pixel(0, 0, image::Rgba([200, 100, 50, 77]));
		let result = apply_saturation_to_image(img, 0.5);
		assert_eq!(result.get_pixel(0, 0)[3], 77);
	}
}
