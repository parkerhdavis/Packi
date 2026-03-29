use image::{DynamicImage, GenericImageView, RgbaImage};

use crate::image_io::{encode_to_base64_png, load_dynamic_image, save_image};

/// Flip the green channel of a normal map (DX ↔ OpenGL conversion).
#[tauri::command]
pub fn flip_normal_green(path: String) -> Result<String, String> {
	let img = load_dynamic_image(&path)?;
	let mut rgba = img.to_rgba8();

	for pixel in rgba.pixels_mut() {
		pixel[1] = 255 - pixel[1];
	}

	encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
}

/// Generate a normal map from a grayscale heightmap using Sobel filtering.
#[tauri::command]
pub fn height_to_normal(path: String, strength: f32) -> Result<String, String> {
	let img = load_dynamic_image(&path)?;
	let gray = img.to_luma8();
	let (w, h) = gray.dimensions();

	let mut normal = RgbaImage::new(w, h);

	for y in 0..h {
		for x in 0..w {
			// Sample heights with clamped border handling
			let sample = |sx: i32, sy: i32| -> f32 {
				let cx = sx.clamp(0, w as i32 - 1) as u32;
				let cy = sy.clamp(0, h as i32 - 1) as u32;
				gray.get_pixel(cx, cy)[0] as f32 / 255.0
			};

			let ix = x as i32;
			let iy = y as i32;

			// Sobel kernels for dX and dY
			let dx = -sample(ix - 1, iy - 1) - 2.0 * sample(ix - 1, iy) - sample(ix - 1, iy + 1)
				+ sample(ix + 1, iy - 1) + 2.0 * sample(ix + 1, iy) + sample(ix + 1, iy + 1);

			let dy = -sample(ix - 1, iy - 1) - 2.0 * sample(ix, iy - 1) - sample(ix + 1, iy - 1)
				+ sample(ix - 1, iy + 1) + 2.0 * sample(ix, iy + 1) + sample(ix + 1, iy + 1);

			// Scale gradients by strength
			let nx = -dx * strength;
			let ny = -dy * strength;
			let nz = 1.0f32;

			// Normalize
			let len = (nx * nx + ny * ny + nz * nz).sqrt();
			let nx = nx / len;
			let ny = ny / len;
			let nz = nz / len;

			// Map from [-1,1] to [0,255]
			let r = ((nx * 0.5 + 0.5) * 255.0).round() as u8;
			let g = ((ny * 0.5 + 0.5) * 255.0).round() as u8;
			let b = ((nz * 0.5 + 0.5) * 255.0).round() as u8;

			normal.put_pixel(x, y, image::Rgba([r, g, b, 255]));
		}
	}

	encode_to_base64_png(&DynamicImage::ImageRgba8(normal))
}

/// Blend two normal maps using Reoriented Normal Mapping (RNM).
#[tauri::command]
pub fn blend_normals(path_a: String, path_b: String, blend_factor: f32) -> Result<String, String> {
	let img_a = load_dynamic_image(&path_a)?;
	let img_b = load_dynamic_image(&path_b)?;

	let rgba_a = img_a.to_rgba8();
	let (w, h) = rgba_a.dimensions();

	// Resize B to match A if needed
	let img_b = if img_b.dimensions() != (w, h) {
		img_b.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
	} else {
		img_b
	};
	let rgba_b = img_b.to_rgba8();

	let mut result = RgbaImage::new(w, h);

	for y in 0..h {
		for x in 0..w {
			let pa = rgba_a.get_pixel(x, y);
			let pb = rgba_b.get_pixel(x, y);

			// Unpack from [0,255] to [-1,1]
			let a = [
				pa[0] as f32 / 255.0 * 2.0 - 1.0,
				pa[1] as f32 / 255.0 * 2.0 - 1.0,
				pa[2] as f32 / 255.0 * 2.0 - 1.0,
			];
			let b = [
				pb[0] as f32 / 255.0 * 2.0 - 1.0,
				pb[1] as f32 / 255.0 * 2.0 - 1.0,
				pb[2] as f32 / 255.0 * 2.0 - 1.0,
			];

			// Lerp B toward flat normal (0,0,1) based on blend_factor
			let b = [
				b[0] * blend_factor,
				b[1] * blend_factor,
				b[2] * blend_factor + (1.0 - blend_factor),
			];

			// RNM blend: t = a * (1,1,1) + (0,0,1), u = b * (-1,-1,1)
			let t = [a[0], a[1], a[2] + 1.0];
			let u = [-b[0], -b[1], b[2]];

			// r = t * dot(t, u) / t.z - u
			let dot = t[0] * u[0] + t[1] * u[1] + t[2] * u[2];
			let r = if t[2].abs() > 1e-6 {
				[
					t[0] * dot / t[2] - u[0],
					t[1] * dot / t[2] - u[1],
					t[2] * dot / t[2] - u[2],
				]
			} else {
				a
			};

			// Normalize
			let len = (r[0] * r[0] + r[1] * r[1] + r[2] * r[2]).sqrt();
			let r = if len > 1e-6 {
				[r[0] / len, r[1] / len, r[2] / len]
			} else {
				[0.0, 0.0, 1.0]
			};

			// Pack back to [0,255]
			let out_r = ((r[0] * 0.5 + 0.5) * 255.0).round() as u8;
			let out_g = ((r[1] * 0.5 + 0.5) * 255.0).round() as u8;
			let out_b = ((r[2] * 0.5 + 0.5) * 255.0).round() as u8;

			result.put_pixel(x, y, image::Rgba([out_r, out_g, out_b, 255]));
		}
	}

	encode_to_base64_png(&DynamicImage::ImageRgba8(result))
}

/// Re-normalize a normal map to unit length.
#[tauri::command]
pub fn normalize_map(path: String) -> Result<String, String> {
	let img = load_dynamic_image(&path)?;
	let mut rgba = img.to_rgba8();

	for pixel in rgba.pixels_mut() {
		// Unpack
		let mut n = [
			pixel[0] as f32 / 255.0 * 2.0 - 1.0,
			pixel[1] as f32 / 255.0 * 2.0 - 1.0,
			pixel[2] as f32 / 255.0 * 2.0 - 1.0,
		];

		// Normalize
		let len = (n[0] * n[0] + n[1] * n[1] + n[2] * n[2]).sqrt();
		if len > 1e-6 {
			n[0] /= len;
			n[1] /= len;
			n[2] /= len;
		}

		// Repack
		pixel[0] = ((n[0] * 0.5 + 0.5) * 255.0).round() as u8;
		pixel[1] = ((n[1] * 0.5 + 0.5) * 255.0).round() as u8;
		pixel[2] = ((n[2] * 0.5 + 0.5) * 255.0).round() as u8;
	}

	encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
}

/// Export a normal map operation result to disk.
#[tauri::command]
pub fn export_normal_result(
	operation: String,
	path: String,
	output_path: String,
	format: String,
	strength: Option<f32>,
	second_path: Option<String>,
	blend_factor: Option<f32>,
) -> Result<(), String> {
	let result_base64 = match operation.as_str() {
		"flip" => flip_normal_green(path)?,
		"height-to-normal" => height_to_normal(path, strength.unwrap_or(1.0))?,
		"blend" => {
			let second = second_path.ok_or("Second path required for blend")?;
			blend_normals(path, second, blend_factor.unwrap_or(0.5))?
		}
		"normalize" => normalize_map(path)?,
		_ => return Err(format!("Unknown operation: {}", operation)),
	};

	// Decode the base64 result and save
	use base64::Engine;
	let bytes = base64::engine::general_purpose::STANDARD
		.decode(&result_base64)
		.map_err(|e| format!("Failed to decode result: {}", e))?;

	let img = image::load_from_memory(&bytes)
		.map_err(|e| format!("Failed to load result image: {}", e))?;

	save_image(&img, &output_path, &format, 8)
}
