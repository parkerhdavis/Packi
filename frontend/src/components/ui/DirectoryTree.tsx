import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { DirEntry } from "@/types";
import {
	LuFolder,
	LuFolderOpen,
	LuImage,
	LuChevronRight,
	LuChevronDown,
	LuFolderPlus,
	LuX,
	LuList,
	LuGrid2X2,
} from "react-icons/lu";

interface DirectoryTreeProps {
	label: string;
	description: string;
	directory: string | null;
	onSetDirectory: (path: string) => void;
	onClearDirectory: () => void;
	/** Set of file paths currently used as inputs in the active module. */
	activeFilePaths?: Set<string>;
	/** View mode: "list" (default) or "grid" */
	viewMode?: "list" | "grid";
	/** Called when view mode changes */
	onViewModeChange?: (mode: "list" | "grid") => void;
}

interface TreeNodeState {
	expanded: boolean;
	children: DirEntry[] | null;
}

/** Shared thumbnail cache across renders (keyed by file path) */
const thumbnailCache = new Map<string, string>();

export default function DirectoryTree({
	label,
	description,
	directory,
	onSetDirectory,
	onClearDirectory,
	activeFilePaths,
	viewMode = "list",
	onViewModeChange,
}: DirectoryTreeProps) {
	const [treeState, setTreeState] = useState<Record<string, TreeNodeState>>({});
	const [tooltip, setTooltip] = useState<{ x: number; y: number; src: string } | null>(null);
	const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setTreeState({});
	}, [directory]);

	const loadChildren = useCallback(async (path: string) => {
		try {
			const entries = await invoke<DirEntry[]>("list_directory", { path });
			setTreeState((prev) => ({
				...prev,
				[path]: { expanded: true, children: entries },
			}));
		} catch (err) {
			console.error("Failed to list directory:", err);
		}
	}, []);

	useEffect(() => {
		if (directory) {
			loadChildren(directory);
		}
	}, [directory, loadChildren]);

	const toggleFolder = useCallback(
		(path: string) => {
			setTreeState((prev) => {
				const current = prev[path];
				if (current?.expanded) {
					return { ...prev, [path]: { ...current, expanded: false } };
				}
				if (!current?.children) {
					loadChildren(path);
					return prev;
				}
				return { ...prev, [path]: { ...current, expanded: true } };
			});
		},
		[loadChildren],
	);

	const handleSelectDir = useCallback(async () => {
		const result = await open({ directory: true, defaultPath: directory ?? undefined });
		if (result) {
			onSetDirectory(result as string);
		}
	}, [directory, onSetDirectory]);

	const handleFileHover = useCallback(async (path: string, e: React.MouseEvent) => {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = rect.right + 8;
		const y = rect.top;

		// Check cache first
		const cached = thumbnailCache.get(path);
		if (cached) {
			setTooltip({ x, y, src: cached });
			return;
		}

		// Debounce loading
		if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
		tooltipTimer.current = setTimeout(async () => {
			try {
				const b64 = await invoke<string>("load_image_as_base64", {
					path,
					maxPreviewSize: 128,
				});
				const src = `data:image/png;base64,${b64}`;
				thumbnailCache.set(path, src);
				setTooltip({ x, y, src });
			} catch {
				// Silently fail for non-loadable files
			}
		}, 150);
	}, []);

	const handleFileLeave = useCallback(() => {
		if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
		setTooltip(null);
	}, []);

	if (!directory) {
		return (
			<div className="flex flex-col gap-2 p-3">
				<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
					{label}
				</div>
				<p className="text-xs text-base-content/40 leading-relaxed">{description}</p>
				<button
					type="button"
					onClick={handleSelectDir}
					className="btn btn-xs btn-ghost gap-1 self-start"
				>
					<LuFolderPlus size={14} />
					Select Folder
				</button>
			</div>
		);
	}

	const dirName = directory.split(/[\\/]/).pop() ?? directory;
	const rootEntries = treeState[directory]?.children ?? [];

	// Collect all files recursively for grid view
	const allFiles: DirEntry[] = [];
	if (viewMode === "grid") {
		const collectFiles = (entries: DirEntry[]) => {
			for (const e of entries) {
				if (e.is_dir) {
					const st = treeState[e.path];
					if (st?.children) collectFiles(st.children);
				} else {
					allFiles.push(e);
				}
			}
		};
		collectFiles(rootEntries);
	}

	return (
		<div className="flex flex-col h-full min-h-0">
			<div className="flex items-center gap-1 px-3 pt-2 pb-2 shrink-0">
				<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider flex-1 truncate">
					{label}
				</div>
				{onViewModeChange && (
					<button
						type="button"
						onClick={() => onViewModeChange(viewMode === "list" ? "grid" : "list")}
						className="btn btn-xs btn-ghost h-5 min-h-0 px-1"
						title={viewMode === "list" ? "Grid view" : "List view"}
					>
						{viewMode === "list" ? <LuGrid2X2 size={12} /> : <LuList size={12} />}
					</button>
				)}
				<button
					type="button"
					onClick={handleSelectDir}
					className="btn btn-xs btn-ghost h-5 min-h-0 px-1"
					title="Change folder"
				>
					<LuFolderPlus size={12} />
				</button>
				<button
					type="button"
					onClick={onClearDirectory}
					className="btn btn-xs btn-ghost h-5 min-h-0 px-1"
					title="Remove folder"
				>
					<LuX size={12} />
				</button>
			</div>
			<div className="px-3 pb-1 shrink-0">
				<span
					className="text-xs text-base-content/40 truncate block"
					title={directory}
				>
					{dirName}
				</span>
			</div>

			{viewMode === "list" ? (
				<div className="flex-1 overflow-y-auto px-1 pb-1">
					{rootEntries.map((entry) => (
						<TreeNode
							key={entry.path}
							entry={entry}
							depth={0}
							treeState={treeState}
							onToggle={toggleFolder}
							activeFilePaths={activeFilePaths}
							onFileHover={handleFileHover}
							onFileLeave={handleFileLeave}
						/>
					))}
					{rootEntries.length === 0 && (
						<p className="text-xs text-base-content/30 px-2 py-1">
							No image files found
						</p>
					)}
				</div>
			) : (
				<div className="flex-1 overflow-y-auto px-2 pb-1">
					{allFiles.length > 0 ? (
						<div className="grid grid-cols-3 gap-1">
							{allFiles.map((entry) => (
								<GridThumbnail
									key={entry.path}
									entry={entry}
									isActive={activeFilePaths?.has(entry.path)}
								/>
							))}
						</div>
					) : (
						<p className="text-xs text-base-content/30 px-2 py-1">
							No image files found
						</p>
					)}
				</div>
			)}

			{/* Hover tooltip */}
			{tooltip && (
				<div
					className="fixed z-50 bg-base-200 border border-base-300 rounded shadow-lg p-1"
					style={{ left: tooltip.x, top: tooltip.y }}
				>
					<img
						src={tooltip.src}
						alt="Preview"
						className="max-w-32 max-h-32"
						style={{ imageRendering: "auto" }}
					/>
				</div>
			)}
		</div>
	);
}

function TreeNode({
	entry,
	depth,
	treeState,
	onToggle,
	activeFilePaths,
	onFileHover,
	onFileLeave,
}: {
	entry: DirEntry;
	depth: number;
	treeState: Record<string, TreeNodeState>;
	onToggle: (path: string) => void;
	activeFilePaths?: Set<string>;
	onFileHover: (path: string, e: React.MouseEvent) => void;
	onFileLeave: () => void;
}) {
	const state = treeState[entry.path];
	const isExpanded = state?.expanded ?? false;
	const children = state?.children ?? [];
	const isActive = !entry.is_dir && activeFilePaths?.has(entry.path);

	if (entry.is_dir) {
		return (
			<div>
				<button
					type="button"
					onClick={() => onToggle(entry.path)}
					className="flex items-center gap-1 w-full px-1 py-0.5 rounded text-xs hover:bg-base-300/50 cursor-pointer"
					style={{ paddingLeft: `${depth * 12 + 4}px` }}
				>
					{isExpanded ? (
						<LuChevronDown size={12} className="shrink-0" />
					) : (
						<LuChevronRight size={12} className="shrink-0" />
					)}
					{isExpanded ? (
						<LuFolderOpen size={12} className="text-primary/70 shrink-0" />
					) : (
						<LuFolder size={12} className="text-primary/70 shrink-0" />
					)}
					<span className="truncate">{entry.name}</span>
				</button>
				{isExpanded &&
					children.map((child) => (
						<TreeNode
							key={child.path}
							entry={child}
							depth={depth + 1}
							treeState={treeState}
							onToggle={onToggle}
							activeFilePaths={activeFilePaths}
							onFileHover={onFileHover}
							onFileLeave={onFileLeave}
						/>
					))}
			</div>
		);
	}

	return (
		<div
			draggable
			onDragStart={(e) => {
				e.dataTransfer.setData("application/packi-filepath", entry.path);
				e.dataTransfer.effectAllowed = "copy";
			}}
			onMouseEnter={(e) => onFileHover(entry.path, e)}
			onMouseLeave={onFileLeave}
			className={`flex items-center gap-1 px-1 py-0.5 rounded text-xs select-none cursor-grab active:cursor-grabbing ${
				isActive
					? "text-primary bg-primary/10"
					: "hover:bg-base-300/50"
			}`}
			style={{ paddingLeft: `${depth * 12 + 20}px` }}
			title={entry.path}
		>
			<LuImage size={12} className={`shrink-0 ${isActive ? "text-primary/70" : "text-base-content/40"}`} />
			<span className="truncate">{entry.name}</span>
			{isActive && <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />}
		</div>
	);
}

function GridThumbnail({
	entry,
	isActive,
}: {
	entry: DirEntry;
	isActive?: boolean;
}) {
	const [src, setSrc] = useState<string | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	// Lazy load using IntersectionObserver
	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					observer.disconnect();
					// Check cache
					const cached = thumbnailCache.get(entry.path);
					if (cached) {
						setSrc(cached);
						return;
					}
					invoke<string>("load_image_as_base64", {
						path: entry.path,
						maxPreviewSize: 96,
					}).then((b64) => {
						const dataSrc = `data:image/png;base64,${b64}`;
						thumbnailCache.set(entry.path, dataSrc);
						setSrc(dataSrc);
					}).catch(() => {});
				}
			},
			{ threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [entry.path]);

	const filename = entry.name.replace(/\.[^.]+$/, "");

	return (
		<div
			ref={ref}
			draggable
			onDragStart={(e) => {
				e.dataTransfer.setData("application/packi-filepath", entry.path);
				e.dataTransfer.effectAllowed = "copy";
			}}
			className={`flex flex-col items-center p-1 rounded cursor-grab active:cursor-grabbing ${
				isActive ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-base-300/50"
			}`}
			title={entry.path}
		>
			<div className="w-full aspect-square bg-base-300/50 rounded overflow-hidden flex items-center justify-center">
				{src ? (
					<img src={src} alt={entry.name} className="max-w-full max-h-full object-contain" />
				) : (
					<LuImage size={16} className="text-base-content/20" />
				)}
			</div>
			<span className="text-[10px] text-base-content/50 truncate w-full text-center mt-0.5">
				{filename}
			</span>
		</div>
	);
}
