import { useState, useCallback, useEffect } from "react";
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
} from "react-icons/lu";

interface DirectoryTreeProps {
	label: string;
	description: string;
	directory: string | null;
	onSetDirectory: (path: string) => void;
	onClearDirectory: () => void;
	/** Set of file paths currently used as inputs in the active module. */
	activeFilePaths?: Set<string>;
}

interface TreeNodeState {
	expanded: boolean;
	children: DirEntry[] | null;
}

export default function DirectoryTree({
	label,
	description,
	directory,
	onSetDirectory,
	onClearDirectory,
	activeFilePaths,
}: DirectoryTreeProps) {
	const [treeState, setTreeState] = useState<Record<string, TreeNodeState>>({});

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

	return (
		<div className="flex flex-col h-full min-h-0">
			<div className="flex items-center gap-1 px-3 pt-2 pb-2 shrink-0">
				<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider flex-1 truncate">
					{label}
				</div>
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
			<div className="flex-1 overflow-y-auto px-1 pb-1">
				{rootEntries.map((entry) => (
					<TreeNode
						key={entry.path}
						entry={entry}
						depth={0}
						treeState={treeState}
						onToggle={toggleFolder}
						activeFilePaths={activeFilePaths}
					/>
				))}
				{rootEntries.length === 0 && (
					<p className="text-xs text-base-content/30 px-2 py-1">
						No image files found
					</p>
				)}
			</div>
		</div>
	);
}

function TreeNode({
	entry,
	depth,
	treeState,
	onToggle,
	activeFilePaths,
}: {
	entry: DirEntry;
	depth: number;
	treeState: Record<string, TreeNodeState>;
	onToggle: (path: string) => void;
	activeFilePaths?: Set<string>;
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
