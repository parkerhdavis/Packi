// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adjust;
mod batch;
mod channel_pack;
mod image_io;
mod normal_map;
mod pipeline;
mod presets;
mod settings;

use adjust::{adjust_hue, adjust_saturation, apply_luminance_curve, export_adjust_result};
use batch::{
	delete_pipeline_preset, list_image_files, load_pipeline_presets, preview_batch, run_batch,
	save_pipeline_preset,
};
use channel_pack::{
	export_packed, export_swizzled, export_unpacked, pack_channels, swizzle_channels,
	unpack_channels,
};
use image_io::{list_directory, load_image_as_base64, load_image_channel, load_image_info};
use normal_map::{blend_normals, export_normal_result, flip_normal_green, height_to_normal, normalize_map};
use pipeline::{apply_adjust_pipeline, export_pipeline_result};
use presets::{delete_user_preset, get_builtin_presets, load_user_presets, save_user_preset};
use settings::{load_settings, save_settings};
use tauri::Manager;
use tracing_subscriber::EnvFilter;

fn init_logging() {
	let log_dir = match dirs::config_dir() {
		Some(d) => d.join("packi").join("logs"),
		None => {
			eprintln!("Warning: could not determine config directory, logging to /tmp/packi/logs");
			std::path::PathBuf::from("/tmp/packi/logs")
		}
	};
	std::fs::create_dir_all(&log_dir).ok();

	let file_appender = tracing_appender::rolling::daily(&log_dir, "packi.log");

	tracing_subscriber::fmt()
		.with_env_filter(
			EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("packi=info")),
		)
		.with_writer(file_appender)
		.with_ansi(false)
		.init();

	tracing::info!("Packi starting up");
}

fn main() {
	init_logging();
	tauri::Builder::default()
		.plugin(tauri_plugin_dialog::init())
		.plugin(tauri_plugin_fs::init())
		.plugin(tauri_plugin_opener::init())
		.setup(|app| {
			// Restore saved window size from settings, if available.
			if let Ok(settings) = settings::load_settings() {
				if let (Some(w), Some(h)) = (settings.window_width, settings.window_height) {
					if let Some(window) = app.get_webview_window("main") {
						let size = tauri::LogicalSize::new(w as f64, h as f64);
						let _ = window.set_size(size);
					}
				}
			}
			Ok(())
		})
		.on_window_event(|window, event| {
			if let tauri::WindowEvent::CloseRequested { .. } = event {
				// Save current window size to settings before closing.
				if let Ok(size) = window.inner_size() {
					if let Ok(scale) = window.scale_factor() {
						let logical_w = (size.width as f64 / scale).round() as u32;
						let logical_h = (size.height as f64 / scale).round() as u32;
						if let Ok(mut current) = settings::load_settings() {
							current.window_width = Some(logical_w);
							current.window_height = Some(logical_h);
							let _ = settings::save_settings(current);
						}
					}
				}
			}
		})
		.invoke_handler(tauri::generate_handler![
			load_settings,
			save_settings,
			load_image_info,
			load_image_as_base64,
			load_image_channel,
			list_directory,
			pack_channels,
			export_packed,
			unpack_channels,
			export_unpacked,
			swizzle_channels,
			export_swizzled,
			get_builtin_presets,
			load_user_presets,
			save_user_preset,
			delete_user_preset,
			apply_luminance_curve,
			adjust_hue,
			adjust_saturation,
			export_adjust_result,
			flip_normal_green,
			height_to_normal,
			blend_normals,
			normalize_map,
			export_normal_result,
			apply_adjust_pipeline,
			export_pipeline_result,
			preview_batch,
			run_batch,
			list_image_files,
			save_pipeline_preset,
			load_pipeline_presets,
			delete_pipeline_preset,
		])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
