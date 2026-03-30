import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSizeStore } from "@/stores/sizeStore";
import { computeMipLevels, GPU_FORMATS, formatBytes } from "@/components/size/vramFormats";

export default function MipChainPanel() {
	const info = useSizeStore((s) => s.inputInfo);
	const preview = useSizeStore((s) => s.inputPreview);
	const [mipPreviews, setMipPreviews] = useState<(string | null)[]>([]);
	const [selectedFormat, setSelectedFormat] = useState("BC7");
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(800);

	const mipLevels = useMemo(() => {
		if (!info) return [];
		return computeMipLevels(info.width, info.height);
	}, [info]);

	const format = GPU_FORMATS.find((f) => f.name.startsWith(selectedFormat)) ?? GPU_FORMATS[6];

	// Measure container width for scaling
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerWidth(entry.contentRect.width);
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Generate mip previews incrementally
	useEffect(() => {
		if (!preview || mipLevels.length === 0) {
			setMipPreviews([]);
			return;
		}

		// Start with all nulls (loading state)
		setMipPreviews(new Array(mipLevels.length).fill(null));

		const img = new Image();
		let cancelled = false;

		img.onload = () => {
			if (cancelled) return;

			// Generate each mip level one at a time, yielding to the event loop between each
			let i = 0;
			const generateNext = () => {
				if (cancelled || i >= mipLevels.length) return;
				const lvl = mipLevels[i];
				const canvas = document.createElement("canvas");
				canvas.width = lvl.width;
				canvas.height = lvl.height;
				const ctx = canvas.getContext("2d")!;
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = "high";
				ctx.drawImage(img, 0, 0, lvl.width, lvl.height);
				const dataUrl = canvas.toDataURL("image/png");

				const idx = i;
				setMipPreviews((prev) => {
					const next = [...prev];
					next[idx] = dataUrl;
					return next;
				});

				i++;
				requestAnimationFrame(generateNext);
			};
			requestAnimationFrame(generateNext);
		};
		img.src = preview.startsWith("data:") ? preview : `data:image/png;base64,${preview}`;

		return () => { cancelled = true; };
	}, [preview, mipLevels]);

	if (!info) {
		return (
			<div className="flex-1 flex items-center justify-center text-base-content/30 text-sm">
				Load an image to view its mip chain.
			</div>
		);
	}

	const totalSize = mipLevels.reduce((sum, lvl) => sum + format.sizeBytes(lvl.width, lvl.height), 0);

	// Scale so the cascade fills the available width with some padding
	const totalCascadeWidth = mipLevels.reduce((sum, lvl) => sum + lvl.width, 0)
		+ (mipLevels.length - 1) * 12; // gap
	const availableWidth = containerWidth - 32; // padding
	const scale = Math.min(1, availableWidth / totalCascadeWidth);

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
			<div ref={containerRef} className="flex-1 overflow-auto p-4">
				<div className="flex flex-wrap items-end gap-3">
					{mipLevels.map((lvl, i) => {
						const displayW = Math.max(8, Math.round(lvl.width * scale));
						const displayH = Math.max(8, Math.round(lvl.height * scale));
						const levelSize = format.sizeBytes(lvl.width, lvl.height);
						const loaded = mipPreviews[i] != null;

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
									{loaded ? (
										<img
											src={mipPreviews[i]!}
											alt={`Mip ${i}`}
											className="w-full h-full"
											style={{ imageRendering: displayW < 32 ? "pixelated" : "auto" }}
										/>
									) : (
										<span className="loading loading-spinner" style={{ width: Math.min(16, displayW - 4), height: Math.min(16, displayH - 4) }} />
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
