use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{DynamicImage, GenericImageView, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
	pub width: u32,
	pub height: u32,
	pub channels: u32,
	pub format: String,
	pub bit_depth: u32,
	pub file_size: u64,
}

#[tauri::command]
pub async fn load_image_info(path: String) -> Result<ImageInfo, String> {
	tokio::task::spawn_blocking(move || load_image_info_sync(&path))
		.await
		.map_err(|e| format!("Task failed: {}", e))?
}

fn load_image_info_sync(path: &str) -> Result<ImageInfo, String> {
	let file_path = Path::new(path);
	let metadata = std::fs::metadata(file_path)
		.map_err(|e| format!("Failed to read file metadata: {}", e))?;

	let reader = ImageReader::open(file_path)
		.map_err(|e| format!("Failed to open image: {}", e))?
		.with_guessed_format()
		.map_err(|e| format!("Failed to detect format: {}", e))?;

	let format = reader
		.format()
		.map(format_to_string)
		.unwrap_or_else(|| "unknown".to_string());

	let img = reader
		.decode()
		.map_err(|e| format!("Failed to decode image: {}", e))?;

	let (width, height) = img.dimensions();
	let channels = img.color().channel_count() as u32;
	let bit_depth = (img.color().bytes_per_pixel() as u32 * 8) / channels;

	Ok(ImageInfo {
		width,
		height,
		channels,
		format,
		bit_depth,
		file_size: metadata.len(),
	})
}

/// Result of loading an image with its preview in a single decode pass.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageWithPreview {
	pub info: ImageInfo,
	pub preview: String,
}

/// Load image info and a base64 preview in a single decode, avoiding redundant I/O.
#[tauri::command]
pub async fn load_image_with_preview(
	path: String,
	max_preview_size: Option<u32>,
) -> Result<ImageWithPreview, String> {
	tokio::task::spawn_blocking(move || {
		let file_path = Path::new(&path);
		let metadata = std::fs::metadata(file_path)
			.map_err(|e| format!("Failed to read file metadata: {}", e))?;

		let reader = ImageReader::open(file_path)
			.map_err(|e| format!("Failed to open image: {}", e))?
			.with_guessed_format()
			.map_err(|e| format!("Failed to detect format: {}", e))?;

		let format = reader
			.format()
			.map(format_to_string)
			.unwrap_or_else(|| "unknown".to_string());

		let img = reader
			.decode()
			.map_err(|e| format!("Failed to decode image: {}", e))?;

		let (width, height) = img.dimensions();
		let channels = img.color().channel_count() as u32;
		let bit_depth = (img.color().bytes_per_pixel() as u32 * 8) / channels;

		let info = ImageInfo {
			width,
			height,
			channels,
			format,
			bit_depth,
			file_size: metadata.len(),
		};

		let preview_img = maybe_resize(img, max_preview_size);
		let preview = encode_to_base64_png(&preview_img)?;

		Ok(ImageWithPreview { info, preview })
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn load_image_as_base64(
	path: String,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || load_image_as_base64_sync(&path, max_preview_size))
		.await
		.map_err(|e| format!("Task failed: {}", e))?
}

fn load_image_as_base64_sync(path: &str, max_preview_size: Option<u32>) -> Result<String, String> {
	let img = maybe_resize(load_dynamic_image(path)?, max_preview_size);
	encode_to_base64_png(&img)
}

#[tauri::command]
pub async fn load_image_channel(path: String, channel: u8) -> Result<String, String> {
	tokio::task::spawn_blocking(move || load_image_channel_sync(&path, channel))
		.await
		.map_err(|e| format!("Task failed: {}", e))?
}

fn load_image_channel_sync(path: &str, channel: u8) -> Result<String, String> {
	let img = load_dynamic_image(path)?;
	let rgba = img.to_rgba8();
	let (w, h) = rgba.dimensions();

	let mut gray = image::GrayImage::new(w, h);
	for (x, y, pixel) in rgba.enumerate_pixels() {
		let val = match channel {
			0 => pixel[0],
			1 => pixel[1],
			2 => pixel[2],
			3 => pixel[3],
			// Luminance: standard weights
			_ => {
				let r = pixel[0] as f32;
				let g = pixel[1] as f32;
				let b = pixel[2] as f32;
				(0.2126 * r + 0.7152 * g + 0.0722 * b).round() as u8
			}
		};
		gray.put_pixel(x, y, image::Luma([val]));
	}

	let dynamic = DynamicImage::ImageLuma8(gray);
	encode_to_base64_png(&dynamic)
}

/// Load a DynamicImage from a file path.
pub fn load_dynamic_image(path: &str) -> Result<DynamicImage, String> {
	let reader = ImageReader::open(path)
		.map_err(|e| format!("Failed to open image: {}", e))?
		.with_guessed_format()
		.map_err(|e| format!("Failed to detect format: {}", e))?;

	reader
		.decode()
		.map_err(|e| format!("Failed to decode image: {}", e))
}

/// Encode a DynamicImage to a base64 PNG string using fast compression.
pub fn encode_to_base64_png(img: &DynamicImage) -> Result<String, String> {
	use base64::Engine;

	let mut buf = Vec::new();
	let cursor = Cursor::new(&mut buf);
	let encoder = PngEncoder::new_with_quality(cursor, CompressionType::Fast, FilterType::Sub);
	img.write_with_encoder(encoder)
		.map_err(|e| format!("Failed to encode PNG: {}", e))?;

	Ok(base64::engine::general_purpose::STANDARD.encode(&buf))
}

/// Optionally downscale an image to fit within `max_size` on its longest axis.
pub fn maybe_resize(img: DynamicImage, max_size: Option<u32>) -> DynamicImage {
	if let Some(max_size) = max_size {
		let (w, h) = img.dimensions();
		if w > max_size || h > max_size {
			img.resize(max_size, max_size, image::imageops::FilterType::CatmullRom)
		} else {
			img
		}
	} else {
		img
	}
}

/// Save a DynamicImage to the specified path and format.
/// Bit depth is determined by the format string: "png8" for 8-bit, "png16" for 16-bit.
pub fn save_image(
	img: &DynamicImage,
	path: &str,
	format: &str,
) -> Result<(), String> {
	let output_path = Path::new(path);

	match format {
		"png" | "png8" => {
			let rgba = img.to_rgba8();
			rgba.save(output_path)
				.map_err(|e| format!("Failed to save PNG: {}", e))?;
		}
		"png16" => {
			let rgba16 = img.to_rgba16();
			rgba16.save(output_path)
				.map_err(|e| format!("Failed to save PNG 16-bit: {}", e))?;
		}
		"tga" => {
			let rgba = DynamicImage::ImageRgba8(img.to_rgba8());
			rgba.save_with_format(output_path, ImageFormat::Tga)
				.map_err(|e| format!("Failed to save TGA: {}", e))?;
		}
		"jpg" | "jpeg" => {
			let rgb = img.to_rgb8();
			rgb.save(output_path)
				.map_err(|e| format!("Failed to save JPEG: {}", e))?;
		}
		_ => return Err(format!("Unsupported export format: {}", format)),
	}

	Ok(())
}

/// Save raw base64-encoded PNG data to a file in the requested format.
/// Used for exporting viewport screenshots (2D/3D previews).
#[tauri::command]
pub async fn save_viewport(
	data: String,
	output_path: String,
	format: String,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		use base64::Engine;
		let bytes = base64::engine::general_purpose::STANDARD
			.decode(&data)
			.map_err(|e| format!("Invalid base64: {}", e))?;
		let img = image::load_from_memory(&bytes)
			.map_err(|e| format!("Failed to decode image: {}", e))?;
		save_image(&img, &output_path, &format)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
	pub name: String,
	pub path: String,
	pub is_dir: bool,
}

/// List immediate children of a directory, returning directories and supported image files.
#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
	let dir_path = Path::new(&path);
	if !dir_path.is_dir() {
		return Err(format!("Not a directory: {}", path));
	}

	let supported = ["png", "tga", "jpg", "jpeg", "tif", "tiff", "bmp", "exr"];
	let mut entries = Vec::new();

	for entry in
		std::fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?
	{
		let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
		let entry_path = entry.path();
		let name = entry.file_name().to_string_lossy().to_string();

		if name.starts_with('.') {
			continue;
		}

		if entry_path.is_dir() {
			entries.push(DirEntry {
				name,
				path: entry_path.to_string_lossy().to_string(),
				is_dir: true,
			});
		} else if let Some(ext) = entry_path.extension().and_then(|s| s.to_str()) {
			if supported.iter().any(|e| e.eq_ignore_ascii_case(ext)) {
				entries.push(DirEntry {
					name,
					path: entry_path.to_string_lossy().to_string(),
					is_dir: false,
				});
			}
		}
	}

	entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
		(true, false) => std::cmp::Ordering::Less,
		(false, true) => std::cmp::Ordering::Greater,
		_ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
	});

	Ok(entries)
}

fn format_to_string(format: ImageFormat) -> String {
	match format {
		ImageFormat::Png => "PNG".to_string(),
		ImageFormat::Jpeg => "JPEG".to_string(),
		ImageFormat::Tga => "TGA".to_string(),
		ImageFormat::Tiff => "TIFF".to_string(),
		ImageFormat::Bmp => "BMP".to_string(),
		_ => format!("{:?}", format),
	}
}
