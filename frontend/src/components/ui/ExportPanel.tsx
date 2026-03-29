import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ExportFormat, ExportConfig } from "@/types";
import { LuFolderOpen, LuDownload } from "react-icons/lu";

const formatLabels: Record<ExportFormat, string> = {
	png8: "PNG (8-bit)",
	png16: "PNG (16-bit)",
	tga: "TGA",
	jpeg: "JPEG",
	exr: "EXR",
};

interface ExportPanelProps {
	formats: ExportFormat[];
	defaultFormat?: ExportFormat;
	onExport: (config: ExportConfig) => Promise<void>;
	disabled?: boolean;
	filenameDefault?: string;
}

export default function ExportPanel({
	formats,
	defaultFormat,
	onExport,
	disabled = false,
	filenameDefault = "output",
}: ExportPanelProps) {
	const lastExportDir = useSettingsStore((s) => s.settings.last_export_dir);
	const outputDir = useSettingsStore((s) => s.settings.output_dir);
	const saveSetting = useSettingsStore((s) => s.save);

	const [format, setFormat] = useState<ExportFormat>(defaultFormat ?? formats[0]);
	const [directory, setDirectory] = useState(lastExportDir ?? outputDir ?? "");
	const [filename, setFilename] = useState(filenameDefault);
	const [exporting, setExporting] = useState(false);

	const handlePickDir = useCallback(async () => {
		const result = await open({ directory: true, defaultPath: directory || outputDir || undefined });
		if (result) {
			setDirectory(result as string);
			await saveSetting({ last_export_dir: result as string });
		}
	}, [directory, outputDir, saveSetting]);

	const handleExport = useCallback(async () => {
		if (!directory || !filename) return;
		setExporting(true);
		try {
			await onExport({ format, directory, filename });
		} finally {
			setExporting(false);
		}
	}, [format, directory, filename, onExport]);

	return (
		<div className="flex flex-col gap-2 p-3 rounded-lg bg-base-200 border border-base-300">
			<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
				Export
			</div>

			<div className="flex gap-2">
				<select
					value={format}
					onChange={(e) => setFormat(e.target.value as ExportFormat)}
					className="select select-xs select-bordered flex-1"
				>
					{formats.map((f) => (
						<option key={f} value={f}>
							{formatLabels[f]}
						</option>
					))}
				</select>
			</div>

			<div className="flex gap-1">
				<input
					type="text"
					value={directory}
					onChange={(e) => setDirectory(e.target.value)}
					placeholder="Output directory..."
					className="input input-xs input-bordered flex-1 font-mono text-xs"
					readOnly
				/>
				<button
					type="button"
					onClick={handlePickDir}
					className="btn btn-xs btn-ghost h-6 min-h-0 px-1.5"
					title="Browse for output directory"
				>
					<LuFolderOpen size={14} />
				</button>
			</div>

			<input
				type="text"
				value={filename}
				onChange={(e) => setFilename(e.target.value)}
				placeholder="Filename..."
				className="input input-xs input-bordered font-mono text-xs"
			/>

			<button
				type="button"
				onClick={handleExport}
				disabled={disabled || exporting || !directory || !filename}
				className="btn btn-primary btn-sm"
			>
				{exporting ? (
					<span className="loading loading-spinner loading-xs" />
				) : (
					<LuDownload size={14} />
				)}
				{exporting ? "Exporting..." : "Export"}
			</button>
		</div>
	);
}
