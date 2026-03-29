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
pub fn pack_channels(config: PackConfig, max_preview_size: Option<u32>) -> Result<String, String> {
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
}

/// Pack channels and export to disk.
#[tauri::command]
pub fn export_packed(
	config: PackConfig,
	output_path: String,
	format: String,
	bit_depth: u8,
) -> Result<(), String> {
	let packed = do_pack(&config)?;
	save_image(&DynamicImage::ImageRgba8(packed), &output_path, &format, bit_depth)
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

/// Find the maximum resolution among all source images.
fn find_max_resolution(config: &PackConfig) -> Result<(u32, u32), String> {
	let mut max_w = 0u32;
	let mut max_h = 0u32;

	for cfg in [&config.r, &config.g, &config.b, &config.a].into_iter().flatten() {
		let img = load_dynamic_image(&cfg.path)?;
		let (w, h) = img.dimensions();
		max_w = max_w.max(w);
		max_h = max_h.max(h);
	}

	Ok((max_w, max_h))
}
