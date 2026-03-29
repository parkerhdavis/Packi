import { useEffect, useCallback } from "react";
import { useChannelPackerStore } from "@/stores/channelPackerStore";
import { useToastStore } from "@/stores/toastStore";
import PageHeader from "@/components/ui/PageHeader";
import TexturePreview from "@/components/ui/TexturePreview";
import ExportPanel from "@/components/ui/ExportPanel";
import ChannelSlotCard from "@/components/ChannelSlotCard";
import type { ExportConfig } from "@/types";

export default function ChannelPacker() {
	const {
		channels,
		preview,
		previewLoading,
		presets,
		activePreset,
		presetLabels,
		loadPresets,
		applyPreset,
		clearPreset,
		exportPacked,
	} = useChannelPackerStore();
	const addToast = useToastStore((s) => s.addToast);

	useEffect(() => {
		loadPresets();
	}, [loadPresets]);

	const hasAnySource = channels.r || channels.g || channels.b || channels.a;

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
		<div className="flex flex-col h-full">
			<PageHeader
				title="Channel Packer"
				subtitle="Pack grayscale maps into RGBA channels"
			/>

			<div className="flex flex-1 min-h-0">
				{/* Left panel — channel slots and controls */}
				<div className="w-80 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
					<div className="p-3 space-y-2">
						{/* Preset selector */}
						<div className="flex gap-2 items-center">
							<select
								value={activePreset ?? ""}
								onChange={(e) => {
									const val = e.target.value;
									if (val) applyPreset(val);
									else clearPreset();
								}}
								className="select select-xs select-bordered flex-1"
							>
								<option value="">No preset</option>
								{presets.map((p) => (
									<option key={p.name} value={p.name}>
										{p.name}
									</option>
								))}
							</select>
						</div>

						{/* Channel slots */}
						<ChannelSlotCard slot="r" label={presetLabels?.r} />
						<ChannelSlotCard slot="g" label={presetLabels?.g} />
						<ChannelSlotCard slot="b" label={presetLabels?.b} />
						<ChannelSlotCard slot="a" label={presetLabels?.a} />
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
					{previewLoading && (
						<div className="absolute inset-0 flex items-center justify-center bg-base-100/50 z-10">
							<span className="loading loading-spinner loading-md text-primary" />
						</div>
					)}
					<TexturePreview
						imageData={preview}
						className="h-full"
					/>
				</div>
			</div>
		</div>
	);
}
