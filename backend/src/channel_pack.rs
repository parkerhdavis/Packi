use image::{DynamicImage, GenericImageView, RgbaImage};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use crate::image_io::{encode_to_base64_png, load_dynamic_image, maybe_resize, save_image};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelSourceConfig {
	pub path: String,
	/// Source channel index: 0=R, 1=G, 2=B, 3=A, 4=Luminance
	pub source_channel: u8,
	pub invert: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackConfig {
	pub r: Option<ChannelSourceConfig>,
	pub g: Option<ChannelSourceConfig>,
	pub b: Option<ChannelSourceConfig>,
	pub a: Option<ChannelSourceConfig>,
	pub target_resolution: Option<(u32, u32)>,
}

/// Pack channels from multiple source images into a single RGBA image.
/// Returns a base64-encoded PNG preview, downsampled to `max_preview_size` if provided.
#[tauri::command]
pub async fn pack_channels(
	config: PackConfig,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || {
		let packed = do_pack(&config)?;
		let preview = maybe_resize(DynamicImage::ImageRgba8(packed), max_preview_size);
		encode_to_base64_png(&preview)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

/// Pack channels and export to disk.
#[tauri::command]
pub async fn export_packed(
	config: PackConfig,
	output_path: String,
	format: String,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		let packed = do_pack(&config)?;
		save_image(
			&DynamicImage::ImageRgba8(packed),
			&output_path,
			&format,
		)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

fn do_pack(config: &PackConfig) -> Result<RgbaImage, String> {
	// Determine target resolution
	let (target_w, target_h) = if let Some(res) = config.target_resolution {
		res
	} else {
		find_max_resolution(config)?
	};

	if target_w == 0 || target_h == 0 {
		return Err("No source images provided".to_string());
	}

	// Load and extract each channel in parallel
	let channels: [Option<&ChannelSourceConfig>; 4] = [
		config.r.as_ref(),
		config.g.as_ref(),
		config.b.as_ref(),
		config.a.as_ref(),
	];

	let channel_data: Vec<Option<Vec<u8>>> = channels
		.par_iter()
		.map(|ch_config| {
			ch_config
				.map(|cfg| extract_channel(cfg, target_w, target_h))
				.transpose()
		})
		.collect::<Result<Vec<_>, _>>()?;

	// Compose the packed image
	let mut packed = RgbaImage::new(target_w, target_h);
	let pixel_count = (target_w * target_h) as usize;

	for i in 0..pixel_count {
		let r = channel_data[0].as_ref().map_or(0u8, |d| d[i]);
		let g = channel_data[1].as_ref().map_or(0u8, |d| d[i]);
		let b = channel_data[2].as_ref().map_or(0u8, |d| d[i]);
		let a = channel_data[3].as_ref().map_or(255u8, |d| d[i]);
		packed.put_pixel(
			(i as u32) % target_w,
			(i as u32) / target_w,
			image::Rgba([r, g, b, a]),
		);
	}

	Ok(packed)
}

/// Extract a single channel from a source image as a flat Vec<u8>.
fn extract_channel(
	config: &ChannelSourceConfig,
	target_w: u32,
	target_h: u32,
) -> Result<Vec<u8>, String> {
	let img = load_dynamic_image(&config.path)?;

	// Resize if needed
	let img = {
		let (w, h) = img.dimensions();
		if w != target_w || h != target_h {
			img.resize_exact(target_w, target_h, image::imageops::FilterType::Lanczos3)
		} else {
			img
		}
	};

	let rgba = img.to_rgba8();
	let pixel_count = (target_w * target_h) as usize;
	let mut data = Vec::with_capacity(pixel_count);

	for pixel in rgba.pixels() {
		let val = match config.source_channel {
			0 => pixel[0],
			1 => pixel[1],
			2 => pixel[2],
			3 => pixel[3],
			// Luminance
			_ => {
				let r = pixel[0] as f32;
				let g = pixel[1] as f32;
				let b = pixel[2] as f32;
				(0.2126 * r + 0.7152 * g + 0.0722 * b).round() as u8
			}
		};

		let val = if config.invert { 255 - val } else { val };
		data.push(val);
	}

	Ok(data)
}

// --- Unpack ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnpackResult {
	pub r: String,
	pub g: String,
	pub b: String,
	pub a: String,
}

/// Extract all 4 RGBA channels from a packed image as separate grayscale previews.
#[tauri::command]
pub async fn unpack_channels(
	path: String,
	max_preview_size: Option<u32>,
) -> Result<UnpackResult, String> {
	tokio::task::spawn_blocking(move || {
		let img = maybe_resize(load_dynamic_image(&path)?, max_preview_size);
		let rgba = img.to_rgba8();
		let (w, h) = rgba.dimensions();

		let channels: Vec<String> = (0u8..4)
			.into_par_iter()
			.map(|ch_idx| {
				let mut gray = image::GrayImage::new(w, h);
				for (x, y, pixel) in rgba.enumerate_pixels() {
					gray.put_pixel(x, y, image::Luma([pixel[ch_idx as usize]]));
				}
				encode_to_base64_png(&DynamicImage::ImageLuma8(gray))
			})
			.collect::<Result<Vec<_>, _>>()?;

		Ok(UnpackResult {
			r: channels[0].clone(),
			g: channels[1].clone(),
			b: channels[2].clone(),
			a: channels[3].clone(),
		})
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

/// Export a single channel from a packed image as a grayscale file.
#[tauri::command]
pub async fn export_unpacked(
	path: String,
	channel: u8,
	output_path: String,
	format: String,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		let img = load_dynamic_image(&path)?;
		let rgba = img.to_rgba8();
		let (w, h) = rgba.dimensions();
		let mut gray = image::GrayImage::new(w, h);
		for (x, y, pixel) in rgba.enumerate_pixels() {
			let val = match channel {
				0 => pixel[0],
				1 => pixel[1],
				2 => pixel[2],
				3 => pixel[3],
				_ => {
					let r = pixel[0] as f32;
					let g = pixel[1] as f32;
					let b = pixel[2] as f32;
					(0.2126 * r + 0.7152 * g + 0.0722 * b).round() as u8
				}
			};
			gray.put_pixel(x, y, image::Luma([val]));
		}
		save_image(&DynamicImage::ImageLuma8(gray), &output_path, &format)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

// --- Swizzle ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwizzleConfig {
	pub r_source: u8,
	pub g_source: u8,
	pub b_source: u8,
	pub a_source: u8,
	pub r_invert: bool,
	pub g_invert: bool,
	pub b_invert: bool,
	pub a_invert: bool,
}

fn read_source(pixel: &image::Rgba<u8>, source: u8, invert: bool) -> u8 {
	let val = match source {
		0 => pixel[0],
		1 => pixel[1],
		2 => pixel[2],
		3 => pixel[3],
		_ => {
			let r = pixel[0] as f32;
			let g = pixel[1] as f32;
			let b = pixel[2] as f32;
			(0.2126 * r + 0.7152 * g + 0.0722 * b).round() as u8
		}
	};
	if invert { 255 - val } else { val }
}

fn do_swizzle(img: &DynamicImage, config: &SwizzleConfig) -> RgbaImage {
	let rgba = img.to_rgba8();
	let (w, h) = rgba.dimensions();
	let mut out = RgbaImage::new(w, h);
	for (x, y, pixel) in rgba.enumerate_pixels() {
		out.put_pixel(x, y, image::Rgba([
			read_source(pixel, config.r_source, config.r_invert),
			read_source(pixel, config.g_source, config.g_invert),
			read_source(pixel, config.b_source, config.b_invert),
			read_source(pixel, config.a_source, config.a_invert),
		]));
	}
	out
}

/// Remap channels in a single image according to a swizzle configuration.
#[tauri::command]
pub async fn swizzle_channels(
	path: String,
	config: SwizzleConfig,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || {
		let img = maybe_resize(load_dynamic_image(&path)?, max_preview_size);
		let result = do_swizzle(&img, &config);
		encode_to_base64_png(&DynamicImage::ImageRgba8(result))
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

/// Export a swizzled image to disk.
#[tauri::command]
pub async fn export_swizzled(
	path: String,
	config: SwizzleConfig,
	output_path: String,
	format: String,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		let img = load_dynamic_image(&path)?;
		let result = do_swizzle(&img, &config);
		save_image(&DynamicImage::ImageRgba8(result), &output_path, &format)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

/// Find the maximum resolution among all source images.
/// Reads just the image headers to avoid full decoding.
fn find_max_resolution(config: &PackConfig) -> Result<(u32, u32), String> {
	let mut max_w = 0u32;
	let mut max_h = 0u32;

	for cfg in [&config.r, &config.g, &config.b, &config.a]
		.into_iter()
		.flatten()
	{
		let (w, h) = image::image_dimensions(&cfg.path)
			.map_err(|e| format!("Failed to read image dimensions for {}: {}", cfg.path, e))?;
		max_w = max_w.max(w);
		max_h = max_h.max(h);
	}

	Ok((max_w, max_h))
}

#[cfg(test)]
mod tests {
	use super::*;

	// --- read_source ---

	#[test]
	fn read_source_channels() {
		let pixel = image::Rgba([10, 20, 30, 40]);
		assert_eq!(read_source(&pixel, 0, false), 10);
		assert_eq!(read_source(&pixel, 1, false), 20);
		assert_eq!(read_source(&pixel, 2, false), 30);
		assert_eq!(read_source(&pixel, 3, false), 40);
	}

	#[test]
	fn read_source_luminance() {
		let pixel = image::Rgba([100, 150, 200, 255]);
		let lum = read_source(&pixel, 4, false);
		// 0.2126*100 + 0.7152*150 + 0.0722*200 ≈ 143.98 → 144
		assert!((lum as i16 - 144).abs() <= 1);
	}

	#[test]
	fn read_source_invert() {
		let pixel = image::Rgba([100, 0, 255, 128]);
		assert_eq!(read_source(&pixel, 0, true), 155);
		assert_eq!(read_source(&pixel, 1, true), 255);
		assert_eq!(read_source(&pixel, 2, true), 0);
	}

	// --- do_swizzle ---

	#[test]
	fn swizzle_identity() {
		let mut img = RgbaImage::new(2, 2);
		img.put_pixel(0, 0, image::Rgba([10, 20, 30, 40]));
		img.put_pixel(1, 0, image::Rgba([50, 60, 70, 80]));
		img.put_pixel(0, 1, image::Rgba([90, 100, 110, 120]));
		img.put_pixel(1, 1, image::Rgba([200, 210, 220, 230]));

		let config = SwizzleConfig {
			r_source: 0,
			g_source: 1,
			b_source: 2,
			a_source: 3,
			r_invert: false,
			g_invert: false,
			b_invert: false,
			a_invert: false,
		};

		let dyn_img = DynamicImage::ImageRgba8(img.clone());
		let result = do_swizzle(&dyn_img, &config);
		assert_eq!(result, img);
	}

	#[test]
	fn swizzle_channel_remap() {
		let mut img = RgbaImage::new(1, 1);
		img.put_pixel(0, 0, image::Rgba([10, 20, 30, 40]));

		// Map: R←B, G←A, B←R, A←G
		let config = SwizzleConfig {
			r_source: 2,
			g_source: 3,
			b_source: 0,
			a_source: 1,
			r_invert: false,
			g_invert: false,
			b_invert: false,
			a_invert: false,
		};

		let dyn_img = DynamicImage::ImageRgba8(img);
		let result = do_swizzle(&dyn_img, &config);
		let p = result.get_pixel(0, 0);
		assert_eq!(*p, image::Rgba([30, 40, 10, 20]));
	}

	#[test]
	fn swizzle_with_invert() {
		let mut img = RgbaImage::new(1, 1);
		img.put_pixel(0, 0, image::Rgba([100, 0, 255, 128]));

		let config = SwizzleConfig {
			r_source: 0,
			g_source: 1,
			b_source: 2,
			a_source: 3,
			r_invert: true,
			g_invert: false,
			b_invert: true,
			a_invert: false,
		};

		let dyn_img = DynamicImage::ImageRgba8(img);
		let result = do_swizzle(&dyn_img, &config);
		let p = result.get_pixel(0, 0);
		assert_eq!(p[0], 155); // 255 - 100
		assert_eq!(p[1], 0);
		assert_eq!(p[2], 0); // 255 - 255
		assert_eq!(p[3], 128);
	}

	// --- do_pack with temp files ---

	#[test]
	fn pack_single_channel_from_file() {
		let tmp_dir = tempfile::tempdir().unwrap();
		let img_path = tmp_dir.path().join("red.png");

		// Create a 4×4 image where R=200
		let mut img = RgbaImage::new(4, 4);
		for pixel in img.pixels_mut() {
			*pixel = image::Rgba([200, 100, 50, 255]);
		}
		img.save(&img_path).unwrap();

		let config = PackConfig {
			r: Some(ChannelSourceConfig {
				path: img_path.to_str().unwrap().to_string(),
				source_channel: 0, // R channel
				invert: false,
			}),
			g: None,
			b: None,
			a: None,
			target_resolution: Some((4, 4)),
		};

		let result = do_pack(&config).unwrap();
		let p = result.get_pixel(0, 0);
		assert_eq!(p[0], 200, "R should come from source R");
		assert_eq!(p[1], 0, "G should be 0 (no source)");
		assert_eq!(p[2], 0, "B should be 0 (no source)");
		assert_eq!(p[3], 255, "A defaults to 255 (no source)");
	}

	#[test]
	fn pack_with_invert() {
		let tmp_dir = tempfile::tempdir().unwrap();
		let img_path = tmp_dir.path().join("test.png");

		let mut img = RgbaImage::new(2, 2);
		for pixel in img.pixels_mut() {
			*pixel = image::Rgba([100, 100, 100, 255]);
		}
		img.save(&img_path).unwrap();

		let config = PackConfig {
			r: Some(ChannelSourceConfig {
				path: img_path.to_str().unwrap().to_string(),
				source_channel: 0,
				invert: true,
			}),
			g: None,
			b: None,
			a: None,
			target_resolution: Some((2, 2)),
		};

		let result = do_pack(&config).unwrap();
		let p = result.get_pixel(0, 0);
		assert_eq!(p[0], 155, "inverted R: 255 - 100 = 155");
	}

	#[test]
	fn pack_no_sources_errors() {
		let config = PackConfig {
			r: None,
			g: None,
			b: None,
			a: None,
			target_resolution: None,
		};
		assert!(do_pack(&config).is_err());
	}
}
