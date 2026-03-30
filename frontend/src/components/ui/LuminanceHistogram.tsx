import { useEffect, useRef } from "react";

interface LuminanceHistogramProps {
	/** Base64-encoded image data (PNG). */
	imageData: string | null;
	/** Width of the histogram in CSS pixels. */
	width?: number;
	/** Height of the histogram in CSS pixels. */
	height?: number;
}

/**
 * Renders a luminance histogram for the given image.
 * Computed client-side from the base64 preview — no backend call needed.
 */
export default function LuminanceHistogram({
	imageData,
	width = 220,
	height = 48,
}: LuminanceHistogramProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// High-DPI support
		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.scale(dpr, dpr);

		ctx.clearRect(0, 0, width, height);

		if (!imageData) return;

		const img = new Image();
		img.onload = () => {
			// Draw image to an offscreen canvas to read pixels
			const offscreen = document.createElement("canvas");
			offscreen.width = img.naturalWidth;
			offscreen.height = img.naturalHeight;
			const offCtx = offscreen.getContext("2d");
			if (!offCtx) return;
			offCtx.drawImage(img, 0, 0);

			const pixels = offCtx.getImageData(0, 0, offscreen.width, offscreen.height).data;

			// Build 256-bin luminance histogram
			const bins = new Uint32Array(256);
			for (let i = 0; i < pixels.length; i += 4) {
				const lum = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
				bins[lum]++;
			}

			// Find max for normalization (ignore extremes which often spike)
			let max = 0;
			for (let i = 1; i < 255; i++) {
				if (bins[i] > max) max = bins[i];
			}
			// Include extremes but cap at 2x the interior max to avoid domination
			max = Math.max(max, 1);
			const capMax = max * 2;

			// Draw histogram
			ctx.clearRect(0, 0, width, height);
			const barWidth = width / 256;

			for (let i = 0; i < 256; i++) {
				const val = Math.min(bins[i], capMax);
				const barHeight = (val / capMax) * height;
				const x = i * barWidth;

				ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
				ctx.fillRect(x, height - barHeight, Math.max(barWidth, 1), barHeight);
			}
		};
		img.src = `data:image/png;base64,${imageData}`;
	}, [imageData, width, height]);

	return (
		<canvas
			ref={canvasRef}
			style={{ width, height, display: "block" }}
			className="rounded border border-base-300"
		/>
	);
}
