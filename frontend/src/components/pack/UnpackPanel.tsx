import { useCallback } from "react";
import { usePackStore } from "@/stores/packStore";
import { useToastStore } from "@/stores/toastStore";
import DropZone from "@/components/ui/DropZone";
import TexturePreview from "@/components/ui/TexturePreview";
import ExportPanel from "@/components/ui/ExportPanel";
import type { ExportConfig } from "@/types";

const channelLabels = [
	{ key: "r" as const, label: "Red", color: "text-red-400" },
	{ key: "g" as const, label: "Green", color: "text-green-400" },
	{ key: "b" as const, label: "Blue", color: "text-blue-400" },
	{ key: "a" as const, label: "Alpha", color: "text-base-content/50" },
];

export default function UnpackPanel() {
	const {
		unpackInputPath,
		unpackInputPreview,
		unpackChannelPreviews,
		unpackLoading,
		loadUnpackInput,
		clearUnpackInput,
		exportUnpackChannel,
	} = usePackStore();
	const addToast = useToastStore((s) => s.addToast);

	const hasChannels = unpackChannelPreviews.r !== null;

	const handleExportAll = useCallback(async (config: ExportConfig) => {
		try {
			const ext = config.format === "png8" || config.format === "png16" ? ".png" : ".tga";
			await Promise.all(
				channelLabels.map((ch) =>
					exportUnpackChannel(ch.key, `${config.directory}/${config.filename}_${ch.key}${ext}`, config.format),
				),
			);
			addToast(`Exported all channels to ${config.filename}_*${ext}`, "success");
		} catch (err) {
			addToast(`Export failed: ${err}`, "error");
		}
	}, [exportUnpackChannel, addToast]);

	return (
		<div className="flex flex-1 min-w-0">
			{/* Left controls */}
			<div className="w-72 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
				{/* Header */}
				<div className="px-3 pt-3 pb-2 border-b border-base-300">
					<div className="text-sm font-semibold text-base-content">Unpack</div>
					<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
						Load a packed RGBA texture and extract each channel as a separate grayscale image.
					</div>
				</div>

				{/* Input */}
				<div className="p-3 border-b border-base-300">
					<label className="text-xs font-semibold text-base-content/50 mb-1 block">
						Packed Texture
					</label>
					<DropZone
						label="Drop packed texture"
						filePath={unpackInputPath}
						thumbnail={unpackInputPreview}
						onFilePicked={loadUnpackInput}
						onClear={clearUnpackInput}
						loading={unpackLoading}
						compact
					/>
				</div>

				{/* Export */}
				<div className="mt-auto p-3">
					<ExportPanel
						formats={["png8", "png16", "tga"]}
						defaultFormat="png8"
						onExport={handleExportAll}
						disabled={!hasChannels}
						filenameDefault="unpacked"
					/>
				</div>
			</div>

			{/* Right — 2x2 channel preview grid */}
			<div className="flex-1 min-w-0 grid grid-cols-2 grid-rows-2">
				{channelLabels.map((ch) => (
					<div key={ch.key} className="relative border-b border-r border-base-300 last:border-r-0">
						<div className={`absolute top-2 left-2 z-10 text-xs ${ch.color} bg-base-200/80 px-2 py-0.5 rounded font-medium`}>
							{ch.label}
						</div>
						<TexturePreview
							imageData={unpackChannelPreviews[ch.key]}
							className="h-full"
						/>
					</div>
				))}
			</div>
		</div>
	);
}
