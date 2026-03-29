import { useCallback } from "react";
import { useNormalToolsStore } from "@/stores/normalToolsStore";
import { useToastStore } from "@/stores/toastStore";
import PageHeader from "@/components/ui/PageHeader";
import TexturePreview from "@/components/ui/TexturePreview";
import ExportPanel from "@/components/ui/ExportPanel";
import DropZone from "@/components/ui/DropZone";
import type { ExportConfig } from "@/types";
import { LuArrowRightLeft, LuMountain, LuLayers, LuTarget } from "react-icons/lu";

const operations = [
	{ id: "flip" as const, label: "Flip Green", icon: <LuArrowRightLeft size={16} /> },
	{ id: "height-to-normal" as const, label: "Height to Normal", icon: <LuMountain size={16} /> },
	{ id: "blend" as const, label: "Blend", icon: <LuLayers size={16} /> },
	{ id: "normalize" as const, label: "Normalize", icon: <LuTarget size={16} /> },
];

export default function NormalMapTools() {
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
		processOperation,
		exportResult,
	} = useNormalToolsStore();
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

	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Normal Map Tools"
				subtitle="Flip, generate, blend, and normalize"
			/>

			<div className="flex flex-1 min-h-0">
				{/* Left panel — controls */}
				<div className="w-80 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
					{/* Operation tabs */}
					<div className="flex border-b border-base-300">
						{operations.map((op) => (
							<button
								key={op.id}
								type="button"
								onClick={() => setOperation(op.id)}
								className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs cursor-pointer transition-colors ${
									activeOperation === op.id
										? "text-primary border-b-2 border-primary bg-primary/5"
										: "text-base-content/50 hover:text-base-content"
								}`}
							>
								{op.icon}
								<span>{op.label}</span>
							</button>
						))}
					</div>

					<div className="p-3 space-y-3">
						{/* Primary input */}
						<div>
							<label className="text-xs font-semibold text-base-content/50 mb-1 block">
								{activeOperation === "height-to-normal" ? "Heightmap" : "Normal Map"}
							</label>
							<DropZone
								label={activeOperation === "height-to-normal" ? "Drop heightmap" : "Drop normal map"}
								filePath={inputPath}
								thumbnail={inputPreview}
								onFilePicked={loadInput}
								onClear={clearInput}
								loading={inputLoading}
								compact
							/>
						</div>

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

						{/* Process button */}
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
					</div>

					{/* Export panel */}
					<div className="mt-auto p-3">
						<ExportPanel
							formats={["png8", "png16", "tga"]}
							defaultFormat="png8"
							onExport={handleExport}
							disabled={!resultPreview}
							filenameDefault="normal_result"
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
