import { useCallback } from "react";
import { usePackStore } from "@/stores/packStore";
import { useToastStore } from "@/stores/toastStore";
import DropZone from "@/components/ui/DropZone";
import TexturePreview from "@/components/ui/TexturePreview";
import ExportPanel from "@/components/ui/ExportPanel";
import type { ExportConfig, ChannelSource } from "@/types";
import { LuRefreshCw } from "react-icons/lu";

const channelRows = [
	{ key: "r" as const, label: "R", dotColor: "bg-red-500" },
	{ key: "g" as const, label: "G", dotColor: "bg-green-500" },
	{ key: "b" as const, label: "B", dotColor: "bg-blue-500" },
	{ key: "a" as const, label: "A", dotColor: "bg-base-content/30" },
];

const sourceOptions: { value: ChannelSource; label: string }[] = [
	{ value: "r", label: "Red" },
	{ value: "g", label: "Green" },
	{ value: "b", label: "Blue" },
	{ value: "a", label: "Alpha" },
	{ value: "luminance", label: "Luminance" },
];

export default function SwizzlePanel() {
	const {
		swizzleInputPath,
		swizzleInputInfo,
		swizzleInputPreview,
		swizzleResultPreview,
		swizzleMappings,
		swizzleInputLoading,
		swizzlePreviewLoading,
		loadSwizzleInput,
		clearSwizzleInput,
		setSwizzleMapping,
		toggleSwizzleInvert,
		exportSwizzled,
	} = usePackStore();
	const addToast = useToastStore((s) => s.addToast);

	const handleExport = useCallback(async (config: ExportConfig) => {
		try {
			const ext = config.format === "png8" || config.format === "png16" ? ".png" : ".tga";
			const outputPath = `${config.directory}/${config.filename}${ext}`;
			const bitDepth = config.format === "png16" ? 16 : 8;
			await exportSwizzled(outputPath, config.format, bitDepth);
			addToast(`Exported to ${config.filename}${ext}`, "success");
		} catch (err) {
			addToast(`Export failed: ${err}`, "error");
		}
	}, [exportSwizzled, addToast]);

	const hasResult = swizzleResultPreview !== null;

	return (
		<div className="flex flex-1 min-w-0">
			{/* Left controls */}
			<div className="w-72 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
				{/* Header */}
				<div className="px-3 pt-3 pb-2 border-b border-base-300">
					<div className="text-sm font-semibold text-base-content">Swizzle</div>
					<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
						Remap channels within a single image. Each output channel can read from any source channel, with optional invert.
					</div>
				</div>

				{/* Input */}
				<div className="p-3 border-b border-base-300">
					<label className="text-xs font-semibold text-base-content/50 mb-1 block">
						Input Image
					</label>
					<DropZone
						label="Drop image"
						filePath={swizzleInputPath}
						thumbnail={swizzleInputPreview}
						onFilePicked={loadSwizzleInput}
						onClear={clearSwizzleInput}
						loading={swizzleInputLoading}
						compact
					/>
				</div>

				{/* Channel mapping */}
				<div className="p-3 space-y-2">
					<label className="text-xs font-semibold text-base-content/50 block">
						Channel Mapping
					</label>
					{channelRows.map((ch) => (
						<div key={ch.key} className="flex items-center gap-2">
							<span className={`size-2.5 rounded-full ${ch.dotColor} shrink-0`} />
							<span className="text-xs font-bold w-4 shrink-0">{ch.label}</span>
							<select
								value={swizzleMappings[ch.key].source}
								onChange={(e) => setSwizzleMapping(ch.key, e.target.value as ChannelSource)}
								className="select select-xs select-bordered flex-1"
							>
								{sourceOptions.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
							<label className="flex items-center gap-1 cursor-pointer">
								<input
									type="checkbox"
									checked={swizzleMappings[ch.key].invert}
									onChange={() => toggleSwizzleInvert(ch.key)}
									className="checkbox checkbox-xs checkbox-primary"
								/>
								<LuRefreshCw size={12} className="text-base-content/50" />
							</label>
						</div>
					))}
				</div>

				{/* Export */}
				<div className="mt-auto p-3">
					<ExportPanel
						formats={["png8", "png16", "tga"]}
						defaultFormat="png8"
						onExport={handleExport}
						disabled={!hasResult}
						filenameDefault="swizzled"
					/>
				</div>
			</div>

			{/* Right — before/after preview */}
			<div className="flex-1 min-w-0 flex">
				<div className="flex-1 border-r border-base-300 relative">
					<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
						Before
					</div>
					<TexturePreview
						imageData={swizzleInputPreview}
						imageInfo={swizzleInputInfo}
						className="h-full"
					/>
				</div>
				<div className="flex-1 relative">
					<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
						After
					</div>
					{swizzlePreviewLoading && (
						<div className="absolute inset-0 flex items-center justify-center bg-base-100/50 z-10">
							<span className="loading loading-spinner loading-md text-primary" />
						</div>
					)}
					<TexturePreview
						imageData={swizzleResultPreview ?? swizzleInputPreview}
						className="h-full"
					/>
				</div>
			</div>
		</div>
	);
}
