import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ImageInfo, ChannelSource } from "@/types";

interface ChannelSlot {
	filePath: string;
	sourceChannel: ChannelSource;
	invert: boolean;
	thumbnail: string;
	info: ImageInfo;
}

interface PackingPreset {
	name: string;
	description: string;
	builtin: boolean;
	labels: { r: string; g: string; b: string; a: string };
}

interface ChannelPackerState {
	channels: {
		r: ChannelSlot | null;
		g: ChannelSlot | null;
		b: ChannelSlot | null;
		a: ChannelSlot | null;
	};
	loadingChannels: { r: boolean; g: boolean; b: boolean; a: boolean };
	preview: string | null;
	previewLoading: boolean;
	activePreset: string | null;
	presetLabels: { r: string; g: string; b: string; a: string } | null;
	presets: PackingPreset[];
	targetResolution: [number, number] | null;

	setChannel: (slot: "r" | "g" | "b" | "a", filePath: string) => Promise<void>;
	clearChannel: (slot: "r" | "g" | "b" | "a") => void;
	setSourceChannel: (slot: "r" | "g" | "b" | "a", channel: ChannelSource) => void;
	toggleInvert: (slot: "r" | "g" | "b" | "a") => void;
	applyPreset: (presetName: string) => void;
	clearPreset: () => void;
	loadPresets: () => Promise<void>;
	regeneratePreview: () => void;
	exportPacked: (outputPath: string, format: string, bitDepth: number) => Promise<void>;
}

const channelSourceToIndex = (ch: ChannelSource): number => {
	switch (ch) {
		case "r": return 0;
		case "g": return 1;
		case "b": return 2;
		case "a": return 3;
		case "luminance": return 4;
	}
};

let previewDebounce: ReturnType<typeof setTimeout> | null = null;

export const useChannelPackerStore = create<ChannelPackerState>((set, get) => ({
	channels: { r: null, g: null, b: null, a: null },
	loadingChannels: { r: false, g: false, b: false, a: false },
	preview: null,
	previewLoading: false,
	activePreset: null,
	presetLabels: null,
	presets: [],
	targetResolution: null,

	setChannel: async (slot, filePath) => {
		set((s) => ({
			loadingChannels: { ...s.loadingChannels, [slot]: true },
		}));
		try {
			const [info, thumbnail] = await Promise.all([
				invoke<ImageInfo>("load_image_info", { path: filePath }),
				invoke<string>("load_image_as_base64", {
					path: filePath,
					maxPreviewSize: 128,
				}),
			]);

			set((s) => ({
				channels: {
					...s.channels,
					[slot]: {
						filePath,
						sourceChannel: "luminance" as ChannelSource,
						invert: false,
						thumbnail,
						info,
					},
				},
				loadingChannels: { ...s.loadingChannels, [slot]: false },
			}));

			get().regeneratePreview();
		} catch (err) {
			console.error(`Failed to load image for channel ${slot}:`, err);
			set((s) => ({
				loadingChannels: { ...s.loadingChannels, [slot]: false },
			}));
		}
	},

	clearChannel: (slot) => {
		set((s) => ({
			channels: { ...s.channels, [slot]: null },
		}));
		get().regeneratePreview();
	},

	setSourceChannel: (slot, channel) => {
		set((s) => {
			const ch = s.channels[slot];
			if (!ch) return s;
			return {
				channels: {
					...s.channels,
					[slot]: { ...ch, sourceChannel: channel },
				},
			};
		});
		get().regeneratePreview();
	},

	toggleInvert: (slot) => {
		set((s) => {
			const ch = s.channels[slot];
			if (!ch) return s;
			return {
				channels: {
					...s.channels,
					[slot]: { ...ch, invert: !ch.invert },
				},
			};
		});
		get().regeneratePreview();
	},

	applyPreset: (presetName) => {
		const preset = get().presets.find((p) => p.name === presetName);
		if (!preset) return;
		set({
			activePreset: presetName,
			presetLabels: preset.labels,
		});
	},

	clearPreset: () => {
		set({ activePreset: null, presetLabels: null });
	},

	loadPresets: async () => {
		try {
			const builtin = await invoke<PackingPreset[]>("get_builtin_presets");
			const user = await invoke<PackingPreset[]>("load_user_presets");
			set({ presets: [...builtin, ...user] });
		} catch (err) {
			console.error("Failed to load presets:", err);
		}
	},

	regeneratePreview: () => {
		if (previewDebounce) clearTimeout(previewDebounce);
		previewDebounce = setTimeout(async () => {
			const { channels, targetResolution } = get();

			// Check if any channel has a source
			const hasSource = channels.r || channels.g || channels.b || channels.a;
			if (!hasSource) {
				set({ preview: null, previewLoading: false });
				return;
			}

			set({ previewLoading: true });

			const makeConfig = (ch: ChannelSlot | null) => {
				if (!ch) return null;
				return {
					path: ch.filePath,
					source_channel: channelSourceToIndex(ch.sourceChannel),
					invert: ch.invert,
				};
			};

			try {
				const preview = await invoke<string>("pack_channels", {
					config: {
						r: makeConfig(channels.r),
						g: makeConfig(channels.g),
						b: makeConfig(channels.b),
						a: makeConfig(channels.a),
						target_resolution: targetResolution,
					},
					maxPreviewSize: 1024,
				});
				set({ preview, previewLoading: false });
			} catch (err) {
				console.error("Failed to pack channels:", err);
				set({ previewLoading: false });
			}
		}, 300);
	},

	exportPacked: async (outputPath, format, bitDepth) => {
		const { channels, targetResolution } = get();

		const makeConfig = (ch: ChannelSlot | null) => {
			if (!ch) return null;
			return {
				path: ch.filePath,
				source_channel: channelSourceToIndex(ch.sourceChannel),
				invert: ch.invert,
			};
		};

		await invoke("export_packed", {
			config: {
				r: makeConfig(channels.r),
				g: makeConfig(channels.g),
				b: makeConfig(channels.b),
				a: makeConfig(channels.a),
				target_resolution: targetResolution,
			},
			outputPath,
			format,
			bitDepth,
		});
	},
}));
