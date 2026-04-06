import { useCallback } from "react";
import { useAdjustStore } from "@/stores/adjustStore";
import type { AdjustOperation } from "@/stores/adjustStore";
import { useAppStore } from "@/stores/appStore";
import { useToastStore } from "@/stores/toastStore";
import PageHeader from "@/components/ui/PageHeader";
import TexturePreview from "@/components/ui/TexturePreview";
import ExportPanel from "@/components/ui/ExportPanel";
import DropZone from "@/components/ui/DropZone";
import CurveEditor from "@/components/ui/CurveEditor";
import type { CurvePoint } from "@/components/ui/CurveEditor";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import SliderWithInput from "@/components/ui/SliderWithInput";
import HistorySidebar from "@/components/HistorySidebar";
import type { ExportConfig } from "@/types";
import {
	LuSpline,
	LuPalette,
	LuDroplets,
	LuArrowRightLeft,
	LuMountain,
	LuLayers,
	LuTarget,
	LuRotateCcw,
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

export default function AdjustTools() {
	const {
		activeOperation,
		inputPath,
		inputInfo,
		inputPreview,
		resultPreview,
		operationParams,
		inputLoading,
		previewLoading,
		setOperation,
		loadInput,
		clearInput,
		updateParams,
		resetOperation,
		isOperationEdited,
		exportResult,
	} = useAdjustStore();
	const historySidebarOpen = useAppStore((s) => s.historySidebarOpen);
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
		updateParams("luminance-curve", { curveLut: lut, curvePoints: _points });
	}, [updateParams]);

	const meta = operationMeta[activeOperation];
	const hasResult = resultPreview !== null;
	const curveParams = operationParams["luminance-curve"];

	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Adjust"
				subtitle="Image adjustments and normal map operations"
			/>

			<div className="flex flex-1 min-h-0">
				{/* Left control area — input bar, submodules+functions, export bar */}
				<div className="flex flex-col shrink-0 border-r border-base-300" style={{ width: "calc(13rem + 18rem)" }}>
					{/* Input bar — spans both columns */}
					<div className="p-3 border-b border-base-300 shrink-0">
						<label className="text-xs font-semibold text-base-content/50 mb-1 block">
							Input Image
						</label>
						<DropZone
							label="Drop image"
							filePath={inputPath}
							thumbnail={inputPreview}
							onFilePicked={loadInput}
							onClear={clearInput}
							loading={inputLoading}
							compact
						/>
					</div>

					{/* Submodules + Functions columns */}
					<div className="flex flex-1 min-h-0">
						{/* Submodules column */}
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
											const edited = isOperationEdited(opId);
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
													<span className="flex-1">{op.label}</span>
													{edited && (
														<span className="size-1.5 rounded-full bg-primary shrink-0" />
													)}
												</button>
											);
										})}
									</div>
								</div>
							))}
						</div>

						{/* Functions column */}
						<div className="flex-1 flex flex-col overflow-y-auto">
							{/* Function header + reset */}
							<div className="flex items-start gap-2 px-3 pt-3 pb-2 border-b border-base-300 shrink-0">
								<div className="flex-1 min-w-0">
									<div className="text-sm font-semibold text-base-content">
										{meta.label}
									</div>
									<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
										{meta.description}
									</div>
								</div>
								{isOperationEdited(activeOperation) && (
									<button
										type="button"
										onClick={() => resetOperation(activeOperation)}
										className="btn btn-ghost btn-xs h-6 min-h-0 px-1.5 shrink-0 mt-0.5"
										title="Reset to default"
									>
										<LuRotateCcw size={12} />
									</button>
								)}
							</div>

							<div className="p-3 space-y-3">
								{activeOperation === "luminance-curve" && (
									<div>
										<label className="text-xs font-semibold text-base-content/50 mb-1.5 block">
											Curve
										</label>
										<CurveEditor
											key={curveParams.curvePoints ? JSON.stringify(curveParams.curvePoints) : "default"}
											points={curveParams.curvePoints ?? undefined}
											width={240}
											height={240}
											onChange={handleCurveChange}
											histogramImageData={resultPreview ?? inputPreview}
										/>
										<div className="flex justify-between text-xs text-base-content/30 mt-1">
											<span>Shadows</span>
											<span>Highlights</span>
										</div>
									</div>
								)}

								{activeOperation === "adjust-hue" && (
									<SliderWithInput
										label="Hue Offset"
										value={operationParams["adjust-hue"].hueOffset}
										onChange={(v) => updateParams("adjust-hue", { hueOffset: v })}
										min={-180}
										max={180}
										step={1}
										unit="°"
										decimals={0}
										showSign
										rangeLabels={["-180°", "0°", "+180°"]}
									/>
								)}

								{activeOperation === "adjust-saturation" && (
									<SliderWithInput
										label="Saturation"
										value={operationParams["adjust-saturation"].saturationOffset}
										onChange={(v) => updateParams("adjust-saturation", { saturationOffset: v })}
										min={-1}
										max={1}
										step={0.01}
										decimals={2}
										showSign
										rangeLabels={["Desaturate", "Normal", "Saturate"]}
									/>
								)}

								{activeOperation === "flip" && (
									<div className="flex items-center justify-between">
										<label className="text-xs font-semibold text-base-content/50">
											Enable Flip Green
										</label>
										<input
											type="checkbox"
											className="toggle toggle-primary toggle-sm"
											checked={operationParams.flip.enabled}
											onChange={(e) => updateParams("flip", { enabled: e.target.checked })}
										/>
									</div>
								)}

								{activeOperation === "height-to-normal" && (
									<SliderWithInput
										label="Strength"
										value={operationParams["height-to-normal"].strength}
										onChange={(v) => updateParams("height-to-normal", { strength: v })}
										min={0.1}
										max={10}
										step={0.1}
										decimals={1}
										rangeLabels={["0.1", "10.0"]}
									/>
								)}

								{activeOperation === "blend" && (
									<>
										<div>
											<label className="text-xs font-semibold text-base-content/50 mb-1 block">
												Normal Map B
											</label>
											<DropZone
												label="Drop second normal map"
												filePath={operationParams.blend.secondInputPath}
												thumbnail={operationParams.blend.secondInputPreview}
												onFilePicked={async (path) => {
													const preview = await import("@tauri-apps/api/core").then(
														(m) => m.invoke<string>("load_image_as_base64", { path, maxPreviewSize: 512 }),
													);
													updateParams("blend", { secondInputPath: path, secondInputPreview: preview });
												}}
												onClear={() => updateParams("blend", { secondInputPath: null, secondInputPreview: null })}
												loading={false}
												compact
											/>
										</div>
										<SliderWithInput
											label="Blend Factor"
											value={operationParams.blend.blendFactor}
											onChange={(v) => updateParams("blend", { blendFactor: v })}
											min={0}
											max={1}
											step={0.01}
											decimals={2}
											rangeLabels={["A only", "Full blend"]}
										/>
									</>
								)}

								{activeOperation === "normalize" && (
									<div className="flex items-center justify-between">
										<label className="text-xs font-semibold text-base-content/50">
											Enable Normalize
										</label>
										<input
											type="checkbox"
											className="toggle toggle-primary toggle-sm"
											checked={operationParams.normalize.enabled}
											onChange={(e) => updateParams("normalize", { enabled: e.target.checked })}
										/>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Export bar — spans both columns */}
					<div className="border-t border-base-300 p-3 shrink-0">
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
						{previewLoading && (
							<LoadingOverlay bgClass="bg-base-100/50" />
						)}
						<TexturePreview
							imageData={resultPreview ?? inputPreview}
							className="h-full"
						/>
					</div>
				</div>

				{/* History sidebar (right) */}
				{historySidebarOpen && <HistorySidebar />}
			</div>
		</div>
	);
}
