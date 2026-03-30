import { useMemo, useEffect, useState, useRef } from "react";
import { useSizeStore } from "@/stores/sizeStore";
import { computeMipLevels, GPU_FORMATS, formatBytes } from "@/components/size/vramFormats";

/** Generate a canvas-downscaled data URL for a given mip level */
function generateMipPreview(
	sourceImg: HTMLImageElement,
	width: number,
	height: number,
): string {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(sourceImg, 0, 0, width, height);
	return canvas.toDataURL("image/png");
}

export default function MipChainPanel() {
	const info = useSizeStore((s) => s.inputInfo);
	const preview = useSizeStore((s) => s.inputPreview);
	const [mipPreviews, setMipPreviews] = useState<string[]>([]);
	const imgRef = useRef<HTMLImageElement | null>(null);
	const [selectedFormat, setSelectedFormat] = useState("BC7");

	const mipLevels = useMemo(() => {
		if (!info) return [];
		return computeMipLevels(info.width, info.height);
	}, [info]);

	const format = GPU_FORMATS.find((f) => f.name.startsWith(selectedFormat)) ?? GPU_FORMATS[6]; // BC7 default

	// Generate mip previews when the input changes
	useEffect(() => {
		if (!preview || mipLevels.length === 0) {
			setMipPreviews([]);
			return;
		}

		const img = new Image();
		img.onload = () => {
			imgRef.current = img;
			const previews = mipLevels.map((lvl) =>
				generateMipPreview(img, lvl.width, lvl.height),
			);
			setMipPreviews(previews);
		};
		img.src = preview.startsWith("data:") ? preview : `data:image/png;base64,${preview}`;
	}, [preview, mipLevels]);

	if (!info) {
		return (
			<div className="flex-1 flex items-center justify-center text-base-content/30 text-sm">
				Load an image to view its mip chain.
			</div>
		);
	}

	const totalSize = mipLevels.reduce((sum, lvl) => sum + format.sizeBytes(lvl.width, lvl.height), 0);

	// Scale factor so the largest mip fits reasonably in the view
	const maxDisplaySize = 256;
	const scale = Math.min(1, maxDisplaySize / Math.max(info.width, info.height));

	return (
		<div className="flex-1 min-w-0 flex flex-col">
			{/* Header bar */}
			<div className="flex items-center gap-4 px-4 py-2 border-b border-base-300 shrink-0">
				<div className="text-sm font-semibold text-base-content">
					{mipLevels.length} mip levels
				</div>
				<div className="text-xs text-base-content/40">
					{info.width}×{info.height} → 1×1
				</div>
				<div className="flex-1" />
				<div className="flex items-center gap-2">
					<label className="text-xs text-base-content/50">Format:</label>
					<select
						value={selectedFormat}
						onChange={(e) => setSelectedFormat(e.target.value)}
						className="select select-xs select-bordered"
					>
						{GPU_FORMATS.map((f) => (
							<option key={f.name} value={f.name.split(" ")[0]}>
								{f.name}
							</option>
						))}
					</select>
				</div>
				<div className="text-xs font-mono text-base-content/60">
					Total: {formatBytes(totalSize)}
				</div>
			</div>

			{/* Mip cascade */}
			<div className="flex-1 overflow-auto p-4">
				<div className="flex flex-wrap items-end gap-3">
					{mipLevels.map((lvl, i) => {
						const displayW = Math.max(8, Math.round(lvl.width * scale));
						const displayH = Math.max(8, Math.round(lvl.height * scale));
						const levelSize = format.sizeBytes(lvl.width, lvl.height);

						return (
							<div key={i} className="flex flex-col items-center gap-1">
								{/* Mip image */}
								<div
									className="bg-base-300/30 rounded border border-base-300/50 overflow-hidden flex items-center justify-center"
									style={{
										width: displayW,
										height: displayH,
										minWidth: 8,
										minHeight: 8,
									}}
								>
									{mipPreviews[i] ? (
										<img
											src={mipPreviews[i]}
											alt={`Mip ${i}`}
											className="w-full h-full"
											style={{ imageRendering: displayW < 32 ? "pixelated" : "auto" }}
										/>
									) : (
										<div className="w-full h-full bg-base-300/50" />
									)}
								</div>

								{/* Labels */}
								<div className="text-center">
									<div className="text-xs font-mono text-base-content/60">
										{lvl.width}×{lvl.height}
									</div>
									<div className="text-xs font-mono text-base-content/30">
										{formatBytes(levelSize)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
