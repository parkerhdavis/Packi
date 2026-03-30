import { useRef, useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import DropZone from "@/components/ui/DropZone";
import type { ImageInfo } from "@/types";

type TilingMode = "repeat" | "mirror";

export default function TilingPreviewPanel() {
	const [inputPath, setInputPath] = useState<string | null>(null);
	const [inputPreview, setInputPreview] = useState<string | null>(null);
	const [inputInfo, setInputInfo] = useState<ImageInfo | null>(null);
	const [loading, setLoading] = useState(false);

	const [gridSize, setGridSize] = useState(3);
	const [tilingMode, setTilingMode] = useState<TilingMode>("repeat");
	const [offsetX, setOffsetX] = useState(false);
	const [offsetY, setOffsetY] = useState(false);
	const [showSeams, setShowSeams] = useState(false);

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const imageRef = useRef<HTMLImageElement | null>(null);

	// Zoom/pan state
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
	const [fitMode, setFitMode] = useState(true);

	const loadInput = useCallback(async (path: string) => {
		setLoading(true);
		try {
			const [info, preview] = await Promise.all([
				invoke<ImageInfo>("load_image_info", { path }),
				invoke<string>("load_image_as_base64", { path, maxPreviewSize: 1024 }),
			]);
			setInputPath(path);
			setInputInfo(info);
			setInputPreview(preview);
		} catch (err) {
			console.error("Failed to load image:", err);
		}
		setLoading(false);
	}, []);

	const clearInput = useCallback(() => {
		setInputPath(null);
		setInputPreview(null);
		setInputInfo(null);
		imageRef.current = null;
	}, []);

	// Load image element when preview changes
	useEffect(() => {
		if (!inputPreview) {
			imageRef.current = null;
			return;
		}
		const img = new Image();
		img.onload = () => {
			imageRef.current = img;
			// Auto-fit on first load
			setFitMode(true);
		};
		img.src = inputPreview.startsWith("data:") ? inputPreview : `data:image/png;base64,${inputPreview}`;
	}, [inputPreview]);

	// Draw tiled preview
	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		const img = imageRef.current;
		if (!canvas || !container || !img) {
			if (canvas) {
				const ctx = canvas.getContext("2d");
				if (ctx) {
					canvas.width = 1;
					canvas.height = 1;
					ctx.clearRect(0, 0, 1, 1);
				}
			}
			return;
		}

		const tileW = img.width;
		const tileH = img.height;
		const totalW = tileW * gridSize;
		const totalH = tileH * gridSize;

		canvas.width = totalW;
		canvas.height = totalH;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.clearRect(0, 0, totalW, totalH);

		// Draw tiles
		for (let row = 0; row < gridSize; row++) {
			for (let col = 0; col < gridSize; col++) {
				const flipH = tilingMode === "mirror" && col % 2 === 1;
				const flipV = tilingMode === "mirror" && row % 2 === 1;

				let drawX = col * tileW;
				let drawY = row * tileH;

				// Apply half-offset
				if (offsetX) drawX += (row % 2) * (tileW / 2);
				if (offsetY) drawY += (col % 2) * (tileH / 2);

				ctx.save();
				ctx.translate(drawX + (flipH ? tileW : 0), drawY + (flipV ? tileH : 0));
				ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
				ctx.drawImage(img, 0, 0, tileW, tileH);
				ctx.restore();
			}
		}

		// Draw seam lines
		if (showSeams) {
			ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			for (let i = 1; i < gridSize; i++) {
				// Vertical seams
				ctx.beginPath();
				ctx.moveTo(i * tileW + 0.5, 0);
				ctx.lineTo(i * tileW + 0.5, totalH);
				ctx.stroke();
				// Horizontal seams
				ctx.beginPath();
				ctx.moveTo(0, i * tileH + 0.5);
				ctx.lineTo(totalW, i * tileH + 0.5);
				ctx.stroke();
			}
			ctx.setLineDash([]);
		}

		// Auto-fit when fitMode changes or grid/image changes
		if (fitMode) {
			const scaleX = container.clientWidth / totalW;
			const scaleY = container.clientHeight / totalH;
			const fitZoom = Math.min(scaleX, scaleY);
			setZoom(fitZoom);
			setPan({
				x: (container.clientWidth - totalW * fitZoom) / 2,
				y: (container.clientHeight - totalH * fitZoom) / 2,
			});
		}
	}, [imageRef.current, gridSize, tilingMode, offsetX, offsetY, showSeams, fitMode]);

	// Wheel zoom
	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		const container = containerRef.current;
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		const newZoom = Math.min(Math.max(zoom * delta, 0.05), 20);
		const scale = newZoom / zoom;
		setPan({ x: mouseX - scale * (mouseX - pan.x), y: mouseY - scale * (mouseY - pan.y) });
		setZoom(newZoom);
		setFitMode(false);
	}, [zoom, pan]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (e.button !== 0) return;
		setIsPanning(true);
		panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
	}, [pan]);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (!isPanning) return;
		setPan({
			x: panStart.current.panX + (e.clientX - panStart.current.x),
			y: panStart.current.panY + (e.clientY - panStart.current.y),
		});
	}, [isPanning]);

	const handleMouseUp = useCallback(() => setIsPanning(false), []);

	const handleFit = useCallback(() => setFitMode(true), []);

	return (
		<div className="flex flex-1 min-w-0">
			{/* Controls */}
			<div className="w-72 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
				{/* Header */}
				<div className="px-3 pt-3 pb-2 border-b border-base-300 shrink-0">
					<div className="text-sm font-semibold text-base-content">2D Tiling Preview</div>
					<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
						Tile a texture in a grid to visually check seamlessness. Use offset mode to inspect center seams.
					</div>
				</div>

				{/* Input */}
				<div className="p-3 border-b border-base-300">
					<label className="text-xs font-semibold text-base-content/50 mb-1 block">
						Texture
					</label>
					<DropZone
						label="Drop texture"
						filePath={inputPath}
						thumbnail={inputPreview}
						onFilePicked={loadInput}
						onClear={clearInput}
						loading={loading}
						compact
					/>
					{inputInfo && (
						<div className="text-xs text-base-content/40 mt-1">
							{inputInfo.width}x{inputInfo.height}
						</div>
					)}
				</div>

				{/* Tiling controls */}
				<div className="p-3 space-y-3">
					{/* Grid size */}
					<div>
						<label className="text-xs font-semibold text-base-content/50 mb-1 block">
							Grid Size: {gridSize}x{gridSize}
						</label>
						<input
							type="range"
							min="1"
							max="8"
							step="1"
							value={gridSize}
							onChange={(e) => { setGridSize(Number.parseInt(e.target.value)); setFitMode(true); }}
							className="range range-primary range-xs w-full"
						/>
						<div className="flex justify-between text-xs text-base-content/30 mt-0.5">
							<span>1</span>
							<span>8</span>
						</div>
					</div>

					{/* Tiling mode */}
					<div>
						<label className="text-xs font-semibold text-base-content/50 mb-1 block">
							Tiling Mode
						</label>
						<select
							value={tilingMode}
							onChange={(e) => setTilingMode(e.target.value as TilingMode)}
							className="select select-xs select-bordered w-full"
						>
							<option value="repeat">Repeat</option>
							<option value="mirror">Mirror</option>
						</select>
					</div>

					{/* Offset */}
					<div>
						<label className="text-xs font-semibold text-base-content/50 mb-1.5 block">
							Half-Tile Offset
						</label>
						<div className="space-y-1.5">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={offsetX}
									onChange={(e) => setOffsetX(e.target.checked)}
									className="checkbox checkbox-xs checkbox-primary"
								/>
								<span className="text-xs text-base-content/60">Offset X (brick pattern)</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={offsetY}
									onChange={(e) => setOffsetY(e.target.checked)}
									className="checkbox checkbox-xs checkbox-primary"
								/>
								<span className="text-xs text-base-content/60">Offset Y (vertical brick)</span>
							</label>
						</div>
					</div>

					{/* Seam highlight */}
					<div>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={showSeams}
								onChange={(e) => setShowSeams(e.target.checked)}
								className="checkbox checkbox-xs checkbox-primary"
							/>
							<span className="text-xs text-base-content/60">Show seam lines</span>
						</label>
					</div>
				</div>
			</div>

			{/* Preview area */}
			<div className="flex-1 min-w-0 flex flex-col">
				{/* Toolbar */}
				<div className="flex items-center gap-1 px-2 py-1 border-b border-base-300 bg-base-200/50 shrink-0">
					<div className="flex-1" />
					<button
						type="button"
						onClick={handleFit}
						className={`btn btn-xs h-6 min-h-0 px-2 ${fitMode ? "btn-primary" : "btn-ghost"}`}
					>
						Fit
					</button>
				</div>

				{/* Canvas */}
				<div
					ref={containerRef}
					className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
					onWheel={handleWheel}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
					style={{
						backgroundImage: "linear-gradient(45deg, var(--color-base-300) 25%, transparent 25%, transparent 75%, var(--color-base-300) 75%), linear-gradient(45deg, var(--color-base-300) 25%, transparent 25%, transparent 75%, var(--color-base-300) 75%)",
						backgroundSize: "16px 16px",
						backgroundPosition: "0 0, 8px 8px",
					}}
				>
					{inputPreview ? (
						<canvas
							ref={canvasRef}
							className="absolute"
							style={{
								transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
								transformOrigin: "0 0",
								imageRendering: zoom > 2 ? "pixelated" : "auto",
							}}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-base-content/30 text-sm">
							Drop a texture to preview tiling
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
