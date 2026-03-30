import { useEffect, useCallback } from "react";
import { usePackStore } from "@/stores/packStore";
import { useToastStore } from "@/stores/toastStore";
import TexturePreview from "@/components/ui/TexturePreview";
import ExportPanel from "@/components/ui/ExportPanel";
import ChannelSlotCard from "@/components/ChannelSlotCard";
import type { ExportConfig } from "@/types";

export default function PackPanel() {
	const {
		packChannels,
		packPreview,
		packPreviewLoading,
		packPresets,
		packActivePreset,
		packPresetLabels,
		loadPresets,
		applyPreset,
		clearPreset,
		exportPacked,
	} = usePackStore();
	const addToast = useToastStore((s) => s.addToast);

	useEffect(() => {
		loadPresets();
	}, [loadPresets]);

	const hasAnySource = packChannels.r || packChannels.g || packChannels.b || packChannels.a;

	const handleExport = useCallback(async (config: ExportConfig) => {
		try {
			const ext = config.format === "png8" || config.format === "png16" ? ".png"
				: config.format === "tga" ? ".tga"
				: config.format === "jpeg" ? ".jpg"
				: config.format === "exr" ? ".exr"
				: ".png";
			const bitDepth = config.format === "png16" ? 16 : 8;
			const outputPath = `${config.directory}/${config.filename}${ext}`;

			await exportPacked(outputPath, config.format, bitDepth);
			addToast(`Exported to ${config.filename}${ext}`, "success");
		} catch (err) {
			addToast(`Export failed: ${err}`, "error");
		}
	}, [exportPacked, addToast]);

	return (
		<div className="flex flex-1 min-w-0">
			{/* Left panel — channel slots and controls */}
			<div className="w-80 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
				{/* Header */}
				<div className="px-3 pt-3 pb-2 border-b border-base-300">
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
					</div>

					{/* Channel slots */}
					<ChannelSlotCard slot="r" label={packPresetLabels?.r} />
					<ChannelSlotCard slot="g" label={packPresetLabels?.g} />
					<ChannelSlotCard slot="b" label={packPresetLabels?.b} />
					<ChannelSlotCard slot="a" label={packPresetLabels?.a} />
				</div>

				{/* Export panel */}
				<div className="mt-auto p-3">
					<ExportPanel
						formats={["png8", "png16", "tga"]}
						defaultFormat="png8"
						onExport={handleExport}
						disabled={!hasAnySource}
						filenameDefault="packed"
					/>
				</div>
			</div>

			{/* Right panel — preview */}
			<div className="flex-1 min-w-0 relative">
				{packPreviewLoading && (
					<div className="absolute inset-0 flex items-center justify-center bg-base-100/50 z-10">
						<span className="loading loading-spinner loading-md text-primary" />
					</div>
				)}
				<TexturePreview
					imageData={packPreview}
					className="h-full"
				/>
			</div>
		</div>
	);
}
