import { useCallback } from "react";
import { useAdjustStore } from "@/stores/adjustStore";
import type { AdjustOperation } from "@/stores/adjustStore";
import { useToastStore } from "@/stores/toastStore";
import PageHeader from "@/components/ui/PageHeader";
import TexturePreview from "@/components/ui/TexturePreview";
import ExportPanel from "@/components/ui/ExportPanel";
import DropZone from "@/components/ui/DropZone";
import CurveEditor from "@/components/ui/CurveEditor";
import type { CurvePoint } from "@/components/ui/CurveEditor";
import LuminanceHistogram from "@/components/ui/LuminanceHistogram";
import type { ExportConfig } from "@/types";
import {
	LuSpline,
	LuPalette,
	LuDroplets,
	LuArrowRightLeft,
	LuMountain,
	LuLayers,
	LuTarget,
} from "react-icons/lu";

const operationMeta: Record<AdjustOperation, { label: string; description: string; icon: React.ReactNode }> = {
	"luminance-curve": {
		label: "Luminance Curve",
		description: "Remap tonal values with a curve. Drag points to adjust brightness and contrast across shadows, midtones, and highlights.",
		icon: <LuSpline size={15} />,
	},
	"adjust-hue": {
		label: "Adjust Hue",
		description: "Shift all colors around the color wheel by a fixed offset.",
		icon: <LuPalette size={15} />,
	},
	"adjust-saturation": {
		label: "Adjust Saturation",
		description: "Increase or decrease color intensity across the image.",
		icon: <LuDroplets size={15} />,
	},
	flip: {
		label: "Flip Green",
		description: "Invert the green channel to convert between DirectX and OpenGL normal map conventions.",
		icon: <LuArrowRightLeft size={15} />,
	},
	"height-to-normal": {
		label: "Height to Normal",
		description: "Generate a normal map from a grayscale heightmap using Sobel filtering.",
		icon: <LuMountain size={15} />,
	},
	blend: {
		label: "Blend",
		description: "Combine two normal maps using Reoriented Normal Mapping (RNM).",
		icon: <LuLayers size={15} />,
	},
	normalize: {
		label: "Normalize",
		description: "Re-normalize vectors to unit length, fixing any drift from editing or compression.",
		icon: <LuTarget size={15} />,
	},
};

const sections = [
	{
		id: "general" as const,
		label: "General",
		description: "Basic image adjustments for any texture or flat image file.",
		operations: ["luminance-curve", "adjust-hue", "adjust-saturation"] as AdjustOperation[],
	},
	{
		id: "normals" as const,
		label: "Normals",
		description: "Tools for generating, converting, and refining normal maps.",
		operations: ["flip", "height-to-normal", "blend", "normalize"] as AdjustOperation[],
	},
];

const generalOperations = new Set(["luminance-curve", "adjust-hue", "adjust-saturation"]);
const normalOperations = new Set(["flip", "height-to-normal", "blend", "normalize"]);

export default function AdjustTools() {
	const {
		activeOperation,
		inputPath,
		inputInfo,
		inputPreview,
		resultPreview,
		secondInputPath,
		secondInputPreview,
		strength,
		blendFactor,
		hueOffset,
		saturationOffset,
		processing,
		inputLoading,
		secondInputLoading,
		previewLoading,
		setOperation,
		loadInput,
		loadSecondInput,
		clearInput,
		clearSecondInput,
		setStrength,
		setBlendFactor,
		setHueOffset,
		setSaturationOffset,
		setCurveLut,
		processOperation,
		exportResult,
	} = useAdjustStore();
	const addToast = useToastStore((s) => s.addToast);

	const handleExport = useCallback(async (config: ExportConfig) => {
		try {
			const ext = config.format === "png8" || config.format === "png16" ? ".png" : ".tga";
			const outputPath = `${config.directory}/${config.filename}${ext}`;
			await exportResult(outputPath, config.format);
			addToast(`Exported to ${config.filename}${ext}`, "success");
		} catch (err) {
			addToast(`Export failed: ${err}`, "error");
		}
	}, [exportResult, addToast]);

	const handleCurveChange = useCallback((_points: CurvePoint[], lut: number[]) => {
		setCurveLut(lut);
	}, [setCurveLut]);

	const meta = operationMeta[activeOperation];
	const hasResult = resultPreview !== null;

	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Adjust"
				subtitle="Image adjustments and normal map operations"
			/>

			<div className="flex flex-1 min-h-0">
				{/* Interior sidebar — section/function nav */}
				<div className="w-52 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto bg-base-200/30">
					{sections.map((section) => (
						<div key={section.id}>
							<div className="px-3 pt-3 pb-1">
								<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
									{section.label}
								</div>
								<div className="text-xs text-base-content/30 mt-0.5 leading-snug">
									{section.description}
								</div>
							</div>
							<div className="flex flex-col gap-0.5 px-1.5 pb-2">
								{section.operations.map((opId) => {
									const op = operationMeta[opId];
									return (
										<button
											key={opId}
											type="button"
											onClick={() => setOperation(opId)}
											className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-left cursor-pointer transition-colors text-sm ${
												activeOperation === opId
													? "text-primary bg-primary/10 font-medium"
													: "text-base-content/60 hover:text-base-content hover:bg-base-300/50"
											}`}
										>
											<span className="shrink-0 opacity-70">{op.icon}</span>
											<span>{op.label}</span>
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>

				{/* Controls panel */}
				<div className="w-72 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
					{/* Function header */}
					<div className="px-3 pt-3 pb-2 border-b border-base-300">
						<div className="text-sm font-semibold text-base-content">
							{meta.label}
						</div>
						<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
							{meta.description}
						</div>
					</div>

					<div className="p-3 space-y-3">
						{/* Input dropzone — shared across all operations */}
						<div>
							<label className="text-xs font-semibold text-base-content/50 mb-1 block">
								{activeOperation === "height-to-normal" ? "Heightmap" : "Input Image"}
							</label>
							<DropZone
								label={activeOperation === "height-to-normal" ? "Drop heightmap" : "Drop image"}
								filePath={inputPath}
								thumbnail={inputPreview}
								onFilePicked={loadInput}
								onClear={clearInput}
								loading={inputLoading}
								compact
							/>
						</div>

						{/* Operation-specific controls */}
						{activeOperation === "luminance-curve" && (
							<div>
								<label className="text-xs font-semibold text-base-content/50 mb-1.5 block">
									Curve
								</label>
								<CurveEditor
									width={240}
									height={240}
									onChange={handleCurveChange}
								/>
								<div className="flex justify-between text-xs text-base-content/30 mt-1">
									<span>Shadows</span>
									<span>Highlights</span>
								</div>
								<label className="text-xs font-semibold text-base-content/50 mb-1.5 mt-3 block">
									Histogram
								</label>
								<LuminanceHistogram
									imageData={resultPreview ?? inputPreview}
									width={240}
									height={240}
								/>
							</div>
						)}

						{activeOperation === "adjust-hue" && (
							<div>
								<label className="text-xs font-semibold text-base-content/50 mb-1 block">
									Hue Offset: {hueOffset > 0 ? "+" : ""}{hueOffset.toFixed(0)}°
								</label>
								<input
									type="range"
									min="-180"
									max="180"
									step="1"
									value={hueOffset}
									onChange={(e) => setHueOffset(Number.parseFloat(e.target.value))}
									className="range range-primary range-xs w-full"
								/>
								<div className="flex justify-between text-xs text-base-content/30 mt-0.5">
									<span>-180°</span>
									<span>0°</span>
									<span>+180°</span>
								</div>
							</div>
						)}

						{activeOperation === "adjust-saturation" && (
							<div>
								<label className="text-xs font-semibold text-base-content/50 mb-1 block">
									Saturation: {saturationOffset > 0 ? "+" : ""}{saturationOffset.toFixed(2)}
								</label>
								<input
									type="range"
									min="-1"
									max="1"
									step="0.01"
									value={saturationOffset}
									onChange={(e) => setSaturationOffset(Number.parseFloat(e.target.value))}
									className="range range-primary range-xs w-full"
								/>
								<div className="flex justify-between text-xs text-base-content/30 mt-0.5">
									<span>Desaturate</span>
									<span>Normal</span>
									<span>Saturate</span>
								</div>
							</div>
						)}

						{/* Second input for blend */}
						{activeOperation === "blend" && (
							<div>
								<label className="text-xs font-semibold text-base-content/50 mb-1 block">
									Normal Map B
								</label>
								<DropZone
									label="Drop second normal map"
									filePath={secondInputPath}
									thumbnail={secondInputPreview}
									onFilePicked={loadSecondInput}
									onClear={clearSecondInput}
									loading={secondInputLoading}
									compact
								/>
							</div>
						)}

						{/* Strength slider for height-to-normal */}
						{activeOperation === "height-to-normal" && (
							<div>
								<label className="text-xs font-semibold text-base-content/50 mb-1 block">
									Strength: {strength.toFixed(1)}
								</label>
								<input
									type="range"
									min="0.1"
									max="10"
									step="0.1"
									value={strength}
									onChange={(e) => setStrength(Number.parseFloat(e.target.value))}
									className="range range-primary range-xs w-full"
								/>
								<div className="flex justify-between text-xs text-base-content/30 mt-0.5">
									<span>0.1</span>
									<span>10.0</span>
								</div>
							</div>
						)}

						{/* Blend factor slider */}
						{activeOperation === "blend" && (
							<div>
								<label className="text-xs font-semibold text-base-content/50 mb-1 block">
									Blend Factor: {blendFactor.toFixed(2)}
								</label>
								<input
									type="range"
									min="0"
									max="1"
									step="0.01"
									value={blendFactor}
									onChange={(e) => setBlendFactor(Number.parseFloat(e.target.value))}
									className="range range-primary range-xs w-full"
								/>
								<div className="flex justify-between text-xs text-base-content/30 mt-0.5">
									<span>A only</span>
									<span>Full blend</span>
								</div>
							</div>
						)}

						{/* Process button — for normal ops that need explicit process, and general ops */}
						{normalOperations.has(activeOperation) && (
							<button
								type="button"
								onClick={processOperation}
								disabled={!inputPath || processing || (activeOperation === "blend" && !secondInputPath)}
								className="btn btn-primary btn-sm w-full"
							>
								{processing ? (
									<span className="loading loading-spinner loading-xs" />
								) : null}
								{processing ? "Processing..." : "Process and Preview"}
							</button>
						)}
					</div>

					{/* Export panel */}
					<div className="mt-auto p-3">
						<ExportPanel
							formats={["png8", "png16", "tga"]}
							defaultFormat="png8"
							onExport={handleExport}
							disabled={!hasResult}
							filenameDefault="adjust_result"
						/>
					</div>
				</div>

				{/* Right panel — before/after preview */}
				<div className="flex-1 min-w-0 flex">
					<div className="flex-1 border-r border-base-300 relative">
						<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
							Before
						</div>
						<TexturePreview
							imageData={inputPreview}
							imageInfo={inputInfo}
							className="h-full"
						/>
					</div>
					<div className="flex-1 relative">
						<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
							After
						</div>
						{(processing || previewLoading) && (
							<div className="absolute inset-0 flex items-center justify-center bg-base-100/50 z-10">
								<span className="loading loading-spinner loading-md text-primary" />
							</div>
						)}
						<TexturePreview
							imageData={resultPreview}
							className="h-full"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
