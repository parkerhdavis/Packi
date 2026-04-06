import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePackStore } from "@/stores/packStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import ChannelSlotCard from "@/components/ChannelSlotCard";
import { LuWand } from "react-icons/lu";

export default function PackPanel() {
	const {
		packPresets,
		packActivePreset,
		packPresetLabels,
		loadPresets,
		applyPreset,
		clearPreset,
		autoDetectChannels,
	} = usePackStore();
	const inputDir = useSettingsStore((s) => s.settings.input_dir);
	const addToast = useToastStore((s) => s.addToast);

	const handleAutoDetect = useCallback(async () => {
		if (!inputDir || !packPresetLabels) return;
		try {
			const files = await invoke<string[]>("list_image_files", { dir: inputDir });
			await autoDetectChannels(files);
			addToast("Auto-detected textures from input directory", "success");
		} catch (err) {
			addToast(`Auto-detect failed: ${err}`, "error");
		}
	}, [inputDir, packPresetLabels, autoDetectChannels, addToast]);

	useEffect(() => {
		loadPresets();
	}, [loadPresets]);

	return (
		<>
			{/* Header */}
			<div className="px-3 pt-3 pb-2 border-b border-base-300 shrink-0">
				<div className="text-sm font-semibold text-base-content">Pack</div>
				<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
					Combine separate grayscale textures into a single RGBA image. Use presets for common engine formats.
				</div>
			</div>

			<div className="p-3 space-y-2">
				{/* Preset selector */}
				<div className="flex gap-2 items-center">
					<select
						value={packActivePreset ?? ""}
						onChange={(e) => {
							const val = e.target.value;
							if (val) applyPreset(val);
							else clearPreset();
						}}
						className="select select-xs select-bordered flex-1"
					>
						<option value="">No preset</option>
						{packPresets.map((p) => (
							<option key={p.name} value={p.name}>
								{p.name}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={handleAutoDetect}
						disabled={!inputDir || !packPresetLabels}
						className="btn btn-xs btn-ghost h-6 min-h-0 px-2 gap-1"
						title={!inputDir ? "Set an input directory first" : !packPresetLabels ? "Select a preset first" : "Auto-detect textures from input directory"}
					>
						<LuWand size={12} />
						<span>Auto</span>
					</button>
				</div>

				{/* Channel slots */}
				<ChannelSlotCard slot="r" label={packPresetLabels?.r} />
				<ChannelSlotCard slot="g" label={packPresetLabels?.g} />
				<ChannelSlotCard slot="b" label={packPresetLabels?.b} />
				<ChannelSlotCard slot="a" label={packPresetLabels?.a} />
			</div>
		</>
	);
}
