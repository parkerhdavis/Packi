use image::DynamicImage;
use serde::Deserialize;

use crate::adjust::{apply_hue_to_image, apply_luminance_curve_to_image, apply_saturation_to_image};
use crate::image_io::{encode_to_base64_png, load_dynamic_image, maybe_resize, save_image};
use crate::normal_map::{
	blend_normals_on_image, flip_green_on_image, height_to_normal_on_image, normalize_on_image,
};

#[derive(Deserialize)]
#[serde(tag = "op")]
pub enum PipelineStep {
	#[serde(rename = "luminance-curve")]
	LuminanceCurve { lut: Vec<u8> },

	#[serde(rename = "adjust-hue")]
	AdjustHue { offset: f32 },

	#[serde(rename = "adjust-saturation")]
	AdjustSaturation { offset: f32 },

	#[serde(rename = "flip")]
	FlipGreen,

	#[serde(rename = "height-to-normal")]
	HeightToNormal { strength: f32 },

	#[serde(rename = "blend")]
	Blend {
		second_path: String,
		blend_factor: f32,
	},

	#[serde(rename = "normalize")]
	Normalize,
}

/// Apply a sequence of pipeline steps to a single image, returning base64 PNG.
#[tauri::command]
pub async fn apply_adjust_pipeline(
	path: String,
	steps: Vec<PipelineStep>,
	max_preview_size: Option<u32>,
) -> Result<String, String> {
	tokio::task::spawn_blocking(move || {
		let img = maybe_resize(load_dynamic_image(&path)?, max_preview_size);
		let mut rgba = img.to_rgba8();

		for step in &steps {
			rgba = apply_step(rgba, step)?;
		}

		encode_to_base64_png(&DynamicImage::ImageRgba8(rgba))
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

/// Apply a sequence of pipeline steps and save the result to disk at full resolution.
#[tauri::command]
pub async fn export_pipeline_result(
	path: String,
	steps: Vec<PipelineStep>,
	output_path: String,
	format: String,
) -> Result<(), String> {
	tokio::task::spawn_blocking(move || {
		let img = load_dynamic_image(&path)?;
		let mut rgba = img.to_rgba8();

		for step in &steps {
			rgba = apply_step(rgba, step)?;
		}

		save_image(&DynamicImage::ImageRgba8(rgba), &output_path, &format)
	})
	.await
	.map_err(|e| format!("Task failed: {}", e))?
}

fn apply_step(
	rgba: image::RgbaImage,
	step: &PipelineStep,
) -> Result<image::RgbaImage, String> {
	match step {
		PipelineStep::LuminanceCurve { lut } => {
			if lut.len() != 256 {
				return Err(format!("LUT must have 256 entries, got {}", lut.len()));
			}
			Ok(apply_luminance_curve_to_image(rgba, lut))
		}
		PipelineStep::AdjustHue { offset } => Ok(apply_hue_to_image(rgba, *offset)),
		PipelineStep::AdjustSaturation { offset } => Ok(apply_saturation_to_image(rgba, *offset)),
		PipelineStep::FlipGreen => Ok(flip_green_on_image(rgba)),
		PipelineStep::HeightToNormal { strength } => {
			Ok(height_to_normal_on_image(&rgba, *strength))
		}
		PipelineStep::Blend {
			second_path,
			blend_factor,
		} => {
			let img_b = load_dynamic_image(second_path)?;
			let rgba_b = img_b.to_rgba8();
			Ok(blend_normals_on_image(&rgba, &rgba_b, *blend_factor))
		}
		PipelineStep::Normalize => Ok(normalize_on_image(rgba)),
	}
}
