import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { LuUpload, LuX } from "react-icons/lu";

interface DropZoneProps {
	label: string;
	filePath: string | null;
	thumbnail: string | null;
	onFilePicked: (path: string) => void;
	onClear: () => void;
	accept?: string[];
	compact?: boolean;
}

export default function DropZone({
	label,
	filePath,
	thumbnail,
	onFilePicked,
	onClear,
	accept,
	compact = false,
}: DropZoneProps) {
	const [dragOver, setDragOver] = useState(false);

	const handleBrowse = useCallback(async () => {
		const result = await open({
			multiple: false,
			filters: accept
				? [{ name: "Images", extensions: accept }]
				: [{ name: "Images", extensions: ["png", "tga", "jpg", "jpeg", "exr", "tif", "tiff"] }],
		});
		if (result) {
			onFilePicked(result as string);
		}
	}, [accept, onFilePicked]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(true);
	}, []);

	const handleDragLeave = useCallback(() => {
		setDragOver(false);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
	}, []);

	const filename = filePath?.split(/[\\/]/).pop() ?? null;

	if (filePath && thumbnail) {
		return (
			<div className={`flex items-center gap-2 rounded-lg bg-base-200 border border-base-300 ${compact ? "p-1.5" : "p-2"}`}>
				<img
					src={thumbnail.startsWith("data:") ? thumbnail : `data:image/png;base64,${thumbnail}`}
					alt={filename ?? ""}
					className={`rounded object-cover bg-base-300 ${compact ? "size-8" : "size-12"}`}
				/>
				<div className="flex-1 min-w-0">
					<p className="text-xs font-medium truncate">{filename}</p>
					<p className="text-xs text-base-content/40">{label}</p>
				</div>
				<button
					type="button"
					onClick={onClear}
					className="btn btn-ghost btn-xs h-6 min-h-0 px-1"
					title="Remove"
				>
					<LuX size={14} />
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={handleBrowse}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors cursor-pointer w-full ${
				dragOver
					? "border-primary bg-primary/10"
					: "border-base-300 hover:border-base-content/30 hover:bg-base-200/50"
			} ${compact ? "p-2" : "p-4"}`}
		>
			<LuUpload size={compact ? 14 : 18} className="text-base-content/30" />
			<span className={`text-base-content/40 ${compact ? "text-xs" : "text-sm"}`}>
				{label}
			</span>
		</button>
	);
}
