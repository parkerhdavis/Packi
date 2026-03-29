import { useEffect, useRef, useCallback } from "react";

// canvasSpliner is a UMD module — import the class from the default export
// @ts-expect-error no type declarations for canvasSpliner
import { CanvasSpliner } from "CanvasSpliner";

export interface CurvePoint {
	x: number;
	y: number;
}

interface CurveEditorProps {
	/** Initial control points (normalized 0-1). Defaults to identity line endpoints. */
	points?: CurvePoint[];
	/** Called when the curve changes (on point release, add, or remove). */
	onChange?: (points: CurvePoint[], lut: number[]) => void;
	/** Width of the visible curve area in CSS pixels. */
	width?: number;
	/** Height of the visible curve area in CSS pixels. */
	height?: number;
}

// Internal padding (in canvas pixels) so endpoint handles don't sit at the
// canvas boundary and get clipped. Must be >= control point radius.
const PAD = 14;

/**
 * Convert between the "curve" coordinate space (0-1, what the LUT and
 * external API use) and the padded canvas coordinate space that
 * canvasSpliner operates in.
 */
function curveToCanvas(v: number, canvasSize: number): number {
	return PAD / canvasSize + v * ((canvasSize - 2 * PAD) / canvasSize);
}
function canvasToCurve(v: number, canvasSize: number): number {
	return (v - PAD / canvasSize) / ((canvasSize - 2 * PAD) / canvasSize);
}

/**
 * Generate a 256-entry LUT from a CanvasSpliner instance.
 * Maps the padded inner range back to [0-255].
 */
function buildLut(spliner: InstanceType<typeof CanvasSpliner>): number[] {
	const w: number = spliner._width;
	const h: number = spliner._height;
	const lut: number[] = new Array(256);
	for (let i = 0; i < 256; i++) {
		const xCanvas = curveToCanvas(i / 255, w);
		const yCanvas = spliner.getValue(xCanvas);
		const yCurve = canvasToCurve(yCanvas, h);
		lut[i] = Math.round(Math.max(0, Math.min(1, yCurve)) * 255);
	}
	return lut;
}

/**
 * Extract the current control points from the spliner's internal state,
 * mapped back to curve-space (0-1).
 */
function extractPoints(spliner: InstanceType<typeof CanvasSpliner>): CurvePoint[] {
	const pc = spliner._pointCollection;
	const xSeries: number[] = pc.getXseries();
	const ySeries: number[] = pc.getYseries();
	const w: number = spliner._width;
	const h: number = spliner._height;

	return xSeries.map((x: number, i: number) => ({
		x: canvasToCurve(x / w, w),
		y: canvasToCurve(ySeries[i] / h, h),
	}));
}

export default function CurveEditor({
	points,
	onChange,
	width = 220,
	height = 220,
}: CurveEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const splinerRef = useRef<InstanceType<typeof CanvasSpliner> | null>(null);

	// Actual canvas dimensions include padding on each side
	const canvasW = width + 2 * PAD;
	const canvasH = height + 2 * PAD;

	const emitChange = useCallback(() => {
		const spliner = splinerRef.current;
		if (!spliner || !onChange) return;
		const pts = extractPoints(spliner);
		const lut = buildLut(spliner);
		onChange(pts, lut);
	}, [onChange]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		// Clear any previous instance
		container.innerHTML = "";

		const spliner = new CanvasSpliner(container, canvasW, canvasH, "monotonic");
		splinerRef.current = spliner;

		// Style to match the app theme
		spliner.setBackgroundColor("rgba(0, 0, 0, 0.15)");
		spliner.setGridColor("rgba(255, 255, 255, 0.08)");
		spliner.setTextColor("rgba(255, 255, 255, 0.3)");
		spliner.setCurveColor("idle", "rgba(16, 126, 32, 0.9)");
		spliner.setCurveColor("moving", "rgba(16, 126, 32, 1)");
		spliner.setControlPointColor("idle", "rgba(220, 220, 220, 0.8)");
		spliner.setControlPointColor("hovered", "rgba(255, 255, 255, 0.95)");
		spliner.setControlPointColor("grabbed", "rgba(120, 220, 130, 1)");
		spliner.setCurveThickness(2);
		spliner.setControlPointRadius(8);
		spliner.setGridStep(0.25);

		// Override coordinate display to offset into the visible area
		// (the default draws at the canvas origin, which is in the clipped padding)
		spliner._drawCoordinates = (x: number, y: number) => {
			const textSize = 14 / spliner._screenRatio;
			spliner._ctx.fillStyle = spliner._textColor;
			spliner._ctx.font = `${textSize}px courier`;
			spliner._ctx.fillText(`x: ${x}`, (PAD + 6) / spliner._screenRatio, (PAD + 14) / spliner._screenRatio);
			spliner._ctx.fillText(`y: ${y}`, (PAD + 6) / spliner._screenRatio, (PAD + 28) / spliner._screenRatio);
		};

		// Position canvas so the padded area extends beyond the container
		const canvas = container.querySelector("canvas");
		if (canvas) {
			canvas.style.border = "none";
			canvas.style.display = "block";
			canvas.style.position = "relative";
			canvas.style.left = `${-PAD}px`;
			canvas.style.top = `${-PAD}px`;
		}

		// Add initial points — convert from curve-space (0-1) to padded canvas-space
		const initialPoints = points ?? [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		];
		for (const pt of initialPoints) {
			spliner.add({
				x: curveToCanvas(pt.x, canvasW),
				y: curveToCanvas(pt.y, canvasH),
			}, false);
		}
		spliner.draw();

		// Wire events
		spliner.on("releasePoint", () => emitChange());
		spliner.on("pointAdded", () => emitChange());
		spliner.on("pointRemoved", () => emitChange());

		// --- Out-of-bounds drag handling ---
		// canvasSpliner only listens for mousemove on the canvas element, so
		// dragging outside it drops the interaction. We add a window-level
		// handler that always runs while a point is grabbed, clamping
		// coordinates to the visible curve area and keeping the coordinate
		// readout visible. The canvas's own handler may also fire (when inside
		// the canvas), but our handler runs after and re-clamps to the final
		// position — only the last draw() is composited.
		let windowMoveActive = false;

		const handleWindowMouseMove = (evt: MouseEvent) => {
			if (spliner._pointGrabbedIndex === -1) return;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const rawX = evt.clientX - rect.left;
			const rawY = evt.clientY - rect.top;

			// Clamp to the inner curve area (PAD inset from canvas edges)
			const x = Math.max(PAD, Math.min(canvasW - PAD, rawX));
			const y = Math.max(PAD, Math.min(canvasH - PAD, canvasH - rawY));

			spliner._mouse = { x, y };
			spliner._pointGrabbedIndex = spliner._pointCollection.updatePoint(
				spliner._pointGrabbedIndex, spliner._mouse,
			);
			spliner._pointHoveredIndex = spliner._pointGrabbedIndex;
			spliner.draw();

			// Show x/y coordinates like the spliner does internally
			const grabbedPoint = spliner._pointCollection.getPoint(spliner._pointGrabbedIndex);
			if (grabbedPoint) {
				spliner._drawCoordinates(
					Math.round((grabbedPoint.x / canvasW) * 1000) / 1000,
					Math.round((grabbedPoint.y / canvasH) * 1000) / 1000,
				);
			}

			if (spliner._onEvents.movePoint) {
				spliner._onEvents.movePoint(spliner);
			}
		};

		const handleCanvasMouseDown = () => {
			// Let the spliner's own mousedown fire first to set _pointGrabbedIndex
			requestAnimationFrame(() => {
				if (spliner._pointGrabbedIndex !== -1 && !windowMoveActive) {
					windowMoveActive = true;
					window.addEventListener("mousemove", handleWindowMouseMove);
				}
			});
		};

		const handleWindowMouseUp = () => {
			if (windowMoveActive) {
				windowMoveActive = false;
				window.removeEventListener("mousemove", handleWindowMouseMove);
			}
		};

		canvas?.addEventListener("mousedown", handleCanvasMouseDown);
		window.addEventListener("mouseup", handleWindowMouseUp);

		return () => {
			canvas?.removeEventListener("mousedown", handleCanvasMouseDown);
			window.removeEventListener("mouseup", handleWindowMouseUp);
			window.removeEventListener("mousemove", handleWindowMouseMove);
			splinerRef.current = null;
			container.innerHTML = "";
		};
	}, [canvasW, canvasH]); // Intentionally exclude points/emitChange to avoid re-creating on every change

	// Keep emitChange callback fresh without recreating the spliner
	useEffect(() => {
		const spliner = splinerRef.current;
		if (!spliner) return;
		spliner.on("releasePoint", () => emitChange());
		spliner.on("pointAdded", () => emitChange());
		spliner.on("pointRemoved", () => emitChange());
	}, [emitChange]);

	return (
		<div
			ref={containerRef}
			className="rounded-md border border-base-300"
			style={{ width, height, overflow: "hidden" }}
		/>
	);
}
