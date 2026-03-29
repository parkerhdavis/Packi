// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod batch;
mod channel_pack;
mod image_io;
mod normal_map;
mod presets;
mod settings;

use batch::{
	delete_pipeline_preset, list_image_files, load_pipeline_presets, preview_batch, run_batch,
	save_pipeline_preset,
};
use channel_pack::{export_packed, pack_channels};
use image_io::{load_image_as_base64, load_image_channel, load_image_info};
use normal_map::{blend_normals, export_normal_result, flip_normal_green, height_to_normal, normalize_map};
use presets::{delete_user_preset, get_builtin_presets, load_user_presets, save_user_preset};
use settings::{load_settings, save_settings};
use tauri::Manager;
use tracing_subscriber::EnvFilter;

fn init_logging() {
	let log_dir = dirs::config_dir()
		.map(|d| d.join("packi").join("logs"))
		.expect("Could not determine config directory");
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
			pack_channels,
			export_packed,
			get_builtin_presets,
			load_user_presets,
			save_user_preset,
			delete_user_preset,
			flip_normal_green,
			height_to_normal,
			blend_normals,
			normalize_map,
			export_normal_result,
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
