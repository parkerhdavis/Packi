use image::{DynamicImage, GenericImageView, RgbaImage};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use crate::image_io::{encode_to_base64_png, load_dynamic_image, save_image};

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
		let img = DynamicImage::ImageRgba8(packed);
		let preview = if let Some(max_size) = max_preview_size {
			let (w, h) = img.dimensions();
			if w > max_size || h > max_size {
				img.resize(max_size, max_size, image::imageops::FilterType::Lanczos3)
			} else {
				img
			}
		} else {
			img
		};
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
	bit_depth: u8,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		let packed = do_pack(&config)?;
		save_image(
			&DynamicImage::ImageRgba8(packed),
			&output_path,
			&format,
			bit_depth,
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
		let img = load_dynamic_image(&path)?;
		let img = if let Some(max_size) = max_preview_size {
			let (w, h) = img.dimensions();
			if w > max_size || h > max_size {
				img.resize(max_size, max_size, image::imageops::FilterType::Lanczos3)
			} else {
				img
			}
		} else {
			img
		};

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
			gray.put_pixel(x, y, image::Luma([pixel[channel as usize]]));
		}
		save_image(&DynamicImage::ImageLuma8(gray), &output_path, &format, 8)
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
		let img = load_dynamic_image(&path)?;
		let img = if let Some(max_size) = max_preview_size {
			let (w, h) = img.dimensions();
			if w > max_size || h > max_size {
				img.resize(max_size, max_size, image::imageops::FilterType::Lanczos3)
			} else {
				img
			}
		} else {
			img
		};
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
	bit_depth: u8,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		let img = load_dynamic_image(&path)?;
		let result = do_swizzle(&img, &config);
		save_image(&DynamicImage::ImageRgba8(result), &output_path, &format, bit_depth)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

/// Find the maximum resolution among all source images.
fn find_max_resolution(config: &PackConfig) -> Result<(u32, u32), String> {
	let mut max_w = 0u32;
	let mut max_h = 0u32;

	for cfg in [&config.r, &config.g, &config.b, &config.a]
		.into_iter()
		.flatten()
	{
		let img = load_dynamic_image(&cfg.path)?;
		let (w, h) = img.dimensions();
		max_w = max_w.max(w);
		max_h = max_h.max(h);
	}

	Ok((max_w, max_h))
}
