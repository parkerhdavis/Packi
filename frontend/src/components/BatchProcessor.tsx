import { useEffect, useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBatchStore } from "@/stores/batchStore";
import { useToastStore } from "@/stores/toastStore";
import PageHeader from "@/components/ui/PageHeader";
import { LuPlus, LuFolderOpen, LuTrash2, LuPlay, LuUpload, LuCheck, LuX, LuChevronUp, LuChevronDown, LuGripVertical } from "react-icons/lu";

const stepTypes = [
	{ type: "convert" as const, label: "Convert Format" },
	{ type: "resize" as const, label: "Resize" },
	{ type: "rename" as const, label: "Rename" },
	{ type: "flip-green" as const, label: "Flip Green (DX↔GL)" },
	{ type: "normalize" as const, label: "Normalize" },
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
		moveStep,
		setOutputDir,
		recursive,
		setRecursive,
		continueOnError,
		setContinueOnError,
		previewPipeline,
		runPipeline,
		loadPresets,
		savePreset,
	} = useBatchStore();
	const addToast = useToastStore((s) => s.addToast);
	const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
	const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

	useEffect(() => {
		loadPresets();
	}, [loadPresets]);

	// Auto-refresh preview when inputs or pipeline change
	useEffect(() => {
		if (inputFiles.length === 0 || pipeline.length === 0) {
			useBatchStore.setState({ previewItems: [] });
			return;
		}
		const timer = setTimeout(() => {
			previewPipeline();
		}, 300);
		return () => clearTimeout(timer);
	}, [inputFiles, pipeline, previewPipeline]);

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

	const handleAddStep = useCallback((type: string) => {
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
			case "flip-green":
				addStep({ type: "flip-green" });
				break;
			case "normalize":
				addStep({ type: "normalize" });
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
					<div className="px-2 py-1 border-b border-base-300">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								className="checkbox checkbox-xs checkbox-primary"
								checked={recursive}
								onChange={(e) => setRecursive(e.target.checked)}
							/>
							<span className="text-xs text-base-content/50">Include subfolders</span>
						</label>
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
								<div
									key={`step-${i}`}
									draggable
									onDragStart={(e) => {
										setDragFromIdx(i);
										e.dataTransfer.setData("text/plain", String(i));
										e.dataTransfer.effectAllowed = "move";
									}}
									onDragOver={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setDragOverIdx(i);
									}}
									onDrop={(e) => {
										e.preventDefault();
										e.stopPropagation();
										const from = Number(e.dataTransfer.getData("text/plain"));
										if (!Number.isNaN(from) && from !== i) {
											moveStep(from, i);
										}
										setDragFromIdx(null);
										setDragOverIdx(null);
									}}
									onDragEnd={() => {
										setDragFromIdx(null);
										setDragOverIdx(null);
									}}
									className={`rounded-lg bg-base-200 border p-2 transition-colors ${
										dragOverIdx === i && dragFromIdx !== i
											? "border-primary bg-primary/5"
											: dragFromIdx === i
												? "opacity-50 border-base-300"
												: "border-base-300"
									}`}
								>
									<div className="flex items-center justify-between mb-1">
										<div className="flex items-center gap-1">
											<LuGripVertical size={12} className="text-base-content/30 cursor-grab active:cursor-grabbing shrink-0" />
											<span className="text-xs font-semibold capitalize">{step.type}</span>
										</div>
										<div className="flex items-center gap-0.5">
											<button
												type="button"
												onClick={() => moveStep(i, i - 1)}
												disabled={i === 0}
												className="btn btn-ghost btn-xs h-5 min-h-0 px-0.5 disabled:opacity-20"
												title="Move up"
											>
												<LuChevronUp size={12} />
											</button>
											<button
												type="button"
												onClick={() => moveStep(i, i + 1)}
												disabled={i === pipeline.length - 1}
												className="btn btn-ghost btn-xs h-5 min-h-0 px-0.5 disabled:opacity-20"
												title="Move down"
											>
												<LuChevronDown size={12} />
											</button>
											<button type="button" onClick={() => removeStep(i)} className="btn btn-ghost btn-xs h-5 min-h-0 px-0.5">
												<LuTrash2 size={12} />
											</button>
										</div>
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
											<option value="exr">OpenEXR</option>
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
						<div className="flex gap-2 items-center">
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
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								className="checkbox checkbox-xs checkbox-primary"
								checked={continueOnError}
								onChange={(e) => setContinueOnError(e.target.checked)}
							/>
							<span className="text-xs text-base-content/50">Continue on error</span>
						</label>
					</div>

					{/* Preview table */}
					<div className="flex-1 overflow-y-auto">
						{previewItems.length > 0 ? (
							<table className="table table-xs w-full">
								<thead>
									<tr>
										{(running || result) && <th className="w-6" />}
										<th>Input</th>
										<th>Output</th>
										<th>Format</th>
									</tr>
								</thead>
								<tbody>
									{previewItems.map((item, i) => {
										const done = running
											? progress != null && i < progress.current
											: result != null;
										const failure = result?.failed.find((f) => f.path === item.input_path);
										const active = running && progress != null && i === progress.current;
										return (
											<tr key={`preview-${i}`} className={failure ? "bg-error/5" : ""}>
												{(running || result) && (
													<td className="w-6 px-1">
														{done && !failure && <LuCheck size={12} className="text-success" />}
														{failure && <LuX size={12} className="text-error" title={failure.error} />}
														{active && <span className="loading loading-spinner loading-xs" />}
													</td>
												)}
												<td className="truncate max-w-32 text-xs">{item.input_path.split(/[\\/]/).pop()}</td>
												<td className="text-xs font-mono">{failure ? <span className="text-error" title={failure.error}>{failure.error}</span> : item.output_filename}</td>
												<td className="text-xs">{item.output_format}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						) : (
							<div className="flex items-center justify-center h-full text-base-content/30 text-sm">
								Add files and pipeline steps to begin
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Progress / Result bar */}
			{(running || result) && (
				<div className="px-3 py-2 border-t border-base-300 flex items-center gap-3">
					{running && progress && (
						<>
							<span className="text-xs text-base-content/50 shrink-0">
								{progress.current} / {progress.total}
							</span>
							<progress
								className="progress progress-primary flex-1"
								value={progress.current}
								max={progress.total}
							/>
							<span className="text-xs text-base-content/50 truncate max-w-48">
								{progress.current_file.split(/[\\/]/).pop()}
							</span>
						</>
					)}
					{result && !running && (
						<p className="text-xs">
							<span className="text-success font-semibold">{result.processed}</span> processed
							{result.failed.length > 0 && (
								<span>, <span className="text-error font-semibold">{result.failed.length}</span> failed</span>
							)}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
