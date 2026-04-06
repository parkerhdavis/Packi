import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/types";

interface SettingsState {
	settings: AppSettings;
	loaded: boolean;
	load: () => Promise<void>;
	save: (settings: Partial<AppSettings>) => Promise<void>;
	toggleTheme: () => Promise<void>;
	zoomIn: () => Promise<void>;
	zoomOut: () => Promise<void>;
	zoomReset: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
	settings: {
		theme: null,
		zoom: null,
		window_width: null,
		window_height: null,
		last_export_dir: null,
		last_module: null,
		sidebar_open: null,
		input_dir: null,
		output_dir: null,
		default_normal_type: null,
		last_export_formats: null,
	},
	loaded: false,

	load: async () => {
		try {
			const settings = await invoke<AppSettings>("load_settings");
			// Migrate renamed modules
			if (settings.last_module === "channel-packer") settings.last_module = "pack";
			if (settings.last_module === "normal-tools") settings.last_module = "adjust";
			if (settings.last_module === "tiling") settings.last_module = "preview";
			if (settings.last_module === "file-sizing") settings.last_module = "size";
			applyTheme(settings.theme);
			set({ settings, loaded: true });
		} catch (err) {
			console.error("Failed to load settings:", err);
			set({ loaded: true });
		}
	},

	save: async (partial) => {
		const current = get().settings;
		const updated = { ...current, ...partial };
		try {
			await invoke("save_settings", { settings: updated });
			set({ settings: updated });
		} catch (err) {
			console.error("Failed to save settings:", err);
		}
	},

	toggleTheme: async () => {
		const current = get().settings;
		const next = current.theme === "light" ? "dark" : "light";
		applyTheme(next);
		await get().save({ theme: next });
	},

	zoomIn: async () => {
		const current = get().settings.zoom ?? 100;
		const next = Math.min(current + 5, 200);
		await get().save({ zoom: next });
	},

	zoomOut: async () => {
		const current = get().settings.zoom ?? 100;
		const next = Math.max(current - 5, 50);
		await get().save({ zoom: next });
	},

	zoomReset: async () => {
		await get().save({ zoom: 100 });
	},
}));

function applyTheme(theme: string | null) {
	document.documentElement.setAttribute(
		"data-theme",
		theme === "light" ? "light" : "dark",
	);
}

