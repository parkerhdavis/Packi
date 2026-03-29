import { useEffect, useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBatchStore } from "@/stores/batchStore";
import { useToastStore } from "@/stores/toastStore";
import PageHeader from "@/components/ui/PageHeader";
import { LuPlus, LuFolderOpen, LuTrash2, LuPlay, LuEye, LuUpload } from "react-icons/lu";

const stepTypes = [
	{ type: "convert" as const, label: "Convert Format" },
	{ type: "resize" as const, label: "Resize" },
	{ type: "rename" as const, label: "Rename" },
];

export default function BatchProcessor() {
	const {
		inputFiles,
		pipeline,
		outputDir,
		previewItems,
		running,
		progress,
		result,
		presets,
		addFiles,
		addFolder,
		removeFile,
		clearFiles,
		addStep,
		removeStep,
		updateStep,
		setOutputDir,
		previewPipeline,
		runPipeline,
		loadPresets,
		savePreset,
	} = useBatchStore();
	const addToast = useToastStore((s) => s.addToast);

	useEffect(() => {
		loadPresets();
	}, [loadPresets]);

	const handleAddFiles = useCallback(async () => {
		const result = await open({
			multiple: true,
			filters: [{ name: "Images", extensions: ["png", "tga", "jpg", "jpeg", "tif", "tiff", "bmp"] }],
		});
		if (result && Array.isArray(result)) {
			addFiles(result as string[]);
		}
	}, [addFiles]);

	const handleAddFolder = useCallback(async () => {
		const result = await open({ directory: true });
		if (result) {
			await addFolder(result as string);
		}
	}, [addFolder]);

	const handlePickOutputDir = useCallback(async () => {
		const result = await open({ directory: true });
		if (result) {
			setOutputDir(result as string);
		}
	}, [setOutputDir]);

	const handleRun = useCallback(async () => {
		try {
			await runPipeline();
			addToast("Batch processing complete", "success");
		} catch (err) {
			addToast(`Batch processing failed: ${err}`, "error");
		}
	}, [runPipeline, addToast]);

	const handleAddStep = useCallback((type: "convert" | "resize" | "rename") => {
		switch (type) {
			case "convert":
				addStep({ type: "convert", format: "png8", bit_depth: 8 });
				break;
			case "resize":
				addStep({ type: "resize", mode: "scale", width: 50, height: 50, filter: "lanczos" });
				break;
			case "rename":
				addStep({ type: "rename", pattern: "{name}" });
				break;
		}
	}, [addStep]);

	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Batch Processor"
				subtitle="Bulk format conversion, resize, and rename"
			/>

			<div className="flex flex-1 min-h-0">
				{/* Left: Input files */}
				<div className="w-64 shrink-0 flex flex-col border-r border-base-300">
					<div className="p-2 border-b border-base-300 flex items-center gap-1">
						<span className="text-xs font-semibold text-base-content/50 flex-1">
							Input ({inputFiles.length})
						</span>
						<button type="button" onClick={handleAddFiles} className="btn btn-ghost btn-xs h-6 min-h-0" title="Add files">
							<LuPlus size={14} />
						</button>
						<button type="button" onClick={handleAddFolder} className="btn btn-ghost btn-xs h-6 min-h-0" title="Add folder">
							<LuFolderOpen size={14} />
						</button>
						{inputFiles.length > 0 && (
							<button type="button" onClick={clearFiles} className="btn btn-ghost btn-xs h-6 min-h-0 text-error" title="Clear all">
								<LuTrash2 size={14} />
							</button>
						)}
					</div>
					<div className="flex-1 overflow-y-auto">
						{inputFiles.length === 0 ? (
							<button
								type="button"
								onClick={handleAddFiles}
								className="flex flex-col items-center justify-center h-full gap-2 text-base-content/30 cursor-pointer hover:text-base-content/50 w-full"
							>
								<LuUpload size={24} />
								<span className="text-xs">Add files or folder</span>
							</button>
						) : (
							inputFiles.map((f, i) => (
								<div key={f} className="flex items-center gap-1 px-2 py-1 hover:bg-base-200 group">
									<span className="text-xs truncate flex-1">{f.split(/[\\/]/).pop()}</span>
									<button
										type="button"
										onClick={() => removeFile(i)}
										className="btn btn-ghost btn-xs h-5 min-h-0 px-0.5 opacity-0 group-hover:opacity-100"
									>
										<LuTrash2 size={12} />
									</button>
								</div>
							))
						)}
					</div>
				</div>

				{/* Center: Pipeline */}
				<div className="w-72 shrink-0 flex flex-col border-r border-base-300">
					<div className="p-2 border-b border-base-300 flex items-center gap-1">
						<span className="text-xs font-semibold text-base-content/50 flex-1">Pipeline</span>
						<div className="dropdown dropdown-end">
							<button type="button" tabIndex={0} className="btn btn-ghost btn-xs h-6 min-h-0" title="Add step">
								<LuPlus size={14} />
							</button>
							<ul tabIndex={0} className="dropdown-content menu p-1 shadow bg-base-200 rounded-box w-40 z-20">
								{stepTypes.map((st) => (
									<li key={st.type}>
										<button type="button" onClick={() => handleAddStep(st.type)} className="text-xs">
											{st.label}
										</button>
									</li>
								))}
							</ul>
						</div>
					</div>
					<div className="flex-1 overflow-y-auto p-2 space-y-2">
						{pipeline.length === 0 ? (
							<div className="flex items-center justify-center h-full text-base-content/30 text-xs">
								Add processing steps
							</div>
						) : (
							pipeline.map((step, i) => (
								<div key={`step-${i}`} className="rounded-lg bg-base-200 border border-base-300 p-2">
									<div className="flex items-center justify-between mb-1">
										<span className="text-xs font-semibold capitalize">{step.type}</span>
										<button type="button" onClick={() => removeStep(i)} className="btn btn-ghost btn-xs h-5 min-h-0 px-0.5">
											<LuTrash2 size={12} />
										</button>
									</div>
									{step.type === "convert" && (
										<select
											value={step.format ?? "png8"}
											onChange={(e) => updateStep(i, { ...step, format: e.target.value })}
											className="select select-xs select-bordered w-full"
										>
											<option value="png8">PNG (8-bit)</option>
											<option value="png16">PNG (16-bit)</option>
											<option value="tga">TGA</option>
											<option value="jpeg">JPEG</option>
										</select>
									)}
									{step.type === "resize" && (
										<div className="space-y-1">
											<select
												value={step.mode ?? "scale"}
												onChange={(e) => updateStep(i, { ...step, mode: e.target.value })}
												className="select select-xs select-bordered w-full"
											>
												<option value="scale">Scale %</option>
												<option value="exact">Exact Size</option>
												<option value="nearest-pot">Nearest Power of 2</option>
											</select>
											{step.mode === "exact" && (
												<div className="flex gap-1">
													<input type="number" value={step.width ?? 1024} onChange={(e) => updateStep(i, { ...step, width: Number(e.target.value) })} className="input input-xs input-bordered w-20" placeholder="W" />
													<span className="text-xs self-center">x</span>
													<input type="number" value={step.height ?? 1024} onChange={(e) => updateStep(i, { ...step, height: Number(e.target.value) })} className="input input-xs input-bordered w-20" placeholder="H" />
												</div>
											)}
											{step.mode === "scale" && (
												<input type="number" value={step.width ?? 50} onChange={(e) => updateStep(i, { ...step, width: Number(e.target.value), height: Number(e.target.value) })} className="input input-xs input-bordered w-full" placeholder="Scale %" />
											)}
										</div>
									)}
									{step.type === "rename" && (
										<div>
											<input type="text" value={step.pattern ?? "{name}"} onChange={(e) => updateStep(i, { ...step, pattern: e.target.value })} className="input input-xs input-bordered w-full font-mono" />
											<p className="text-xs text-base-content/30 mt-0.5">{"{name}"} {"{index}"} {"{ext}"}</p>
										</div>
									)}
								</div>
							))
						)}
					</div>
				</div>

				{/* Right: Output & Execute */}
				<div className="flex-1 flex flex-col min-w-0">
					<div className="p-3 border-b border-base-300 space-y-2">
						<div className="flex gap-2 items-center">
							<span className="text-xs font-semibold text-base-content/50">Output:</span>
							<input
								type="text"
								value={outputDir ?? ""}
								readOnly
								placeholder="Select output directory..."
								className="input input-xs input-bordered flex-1 font-mono text-xs"
							/>
							<button type="button" onClick={handlePickOutputDir} className="btn btn-ghost btn-xs h-6 min-h-0">
								<LuFolderOpen size={14} />
							</button>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={previewPipeline}
								disabled={inputFiles.length === 0 || pipeline.length === 0}
								className="btn btn-sm btn-ghost flex-1"
							>
								<LuEye size={14} />
								Preview
							</button>
							<button
								type="button"
								onClick={handleRun}
								disabled={inputFiles.length === 0 || pipeline.length === 0 || !outputDir || running}
								className="btn btn-sm btn-primary flex-1"
							>
								{running ? <span className="loading loading-spinner loading-xs" /> : <LuPlay size={14} />}
								{running ? "Processing..." : "Run"}
							</button>
						</div>
					</div>

					{/* Progress */}
					{running && progress && (
						<div className="px-3 py-2 border-b border-base-300">
							<div className="flex justify-between text-xs text-base-content/50 mb-1">
								<span>{progress.current} / {progress.total}</span>
								<span className="truncate ml-2">{progress.current_file.split(/[\\/]/).pop()}</span>
							</div>
							<progress
								className="progress progress-primary w-full"
								value={progress.current}
								max={progress.total}
							/>
						</div>
					)}

					{/* Result */}
					{result && !running && (
						<div className="px-3 py-2 border-b border-base-300">
							<p className="text-sm">
								<span className="text-success font-semibold">{result.processed}</span> processed
								{result.failed.length > 0 && (
									<span>, <span className="text-error font-semibold">{result.failed.length}</span> failed</span>
								)}
							</p>
						</div>
					)}

					{/* Preview table */}
					<div className="flex-1 overflow-y-auto">
						{previewItems.length > 0 ? (
							<table className="table table-xs w-full">
								<thead>
									<tr>
										<th>Input</th>
										<th>Output</th>
										<th>Format</th>
									</tr>
								</thead>
								<tbody>
									{previewItems.map((item, i) => (
										<tr key={`preview-${i}`}>
											<td className="truncate max-w-32 text-xs">{item.input_path.split(/[\\/]/).pop()}</td>
											<td className="text-xs font-mono">{item.output_filename}</td>
											<td className="text-xs">{item.output_format}</td>
										</tr>
									))}
								</tbody>
							</table>
						) : (
							<div className="flex items-center justify-center h-full text-base-content/30 text-sm">
								{inputFiles.length > 0 && pipeline.length > 0
									? "Click Preview to see output"
									: "Add files and pipeline steps to begin"
								}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
