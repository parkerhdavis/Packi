import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ModuleName } from "@/types";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
	LuLayers,
	LuCompass,
	LuGrid3X3,
	LuFileBox,
	LuFolderCog,
	LuSettings,
	LuPanelLeftClose,
	LuPanelLeftOpen,
	LuFolderInput,
	LuFolderOutput,
} from "react-icons/lu";
import DirectoryTree from "@/components/ui/DirectoryTree";

const modules: { id: ModuleName; label: string; tooltip: string; icon: React.ReactNode }[] = [
	{ id: "adjust", label: "Adjust", tooltip: "Image adjustments and normal map operations", icon: <LuCompass size={20} /> },
	{ id: "pack", label: "Pack", tooltip: "Unpack, swizzle, and pack texture channels", icon: <LuLayers size={20} /> },
	{ id: "tiling", label: "Mesh and Tile", tooltip: "Seamless tiling preview and mesh tools", icon: <LuGrid3X3 size={20} /> },
	{ id: "file-sizing", label: "File Sizing", tooltip: "Crop, resize, and recompress textures", icon: <LuFileBox size={20} /> },
	{ id: "batch-processor", label: "Batch", tooltip: "Bulk format conversion, resize, and rename", icon: <LuFolderCog size={20} /> },
];

export default function Sidebar() {
	const activeModule = useAppStore((s) => s.activeModule);
	const setActiveModule = useAppStore((s) => s.setActiveModule);
	const sidebarOpen = useAppStore((s) => s.sidebarOpen);
	const toggleSidebar = useAppStore((s) => s.toggleSidebar);

	const theme = useSettingsStore((s) => s.settings.theme);
	const inputDir = useSettingsStore((s) => s.settings.input_dir);
	const outputDir = useSettingsStore((s) => s.settings.output_dir);
	const save = useSettingsStore((s) => s.save);

	const splashIcon = theme === "light" ? "/packi-splash-light.png" : "/packi-splash-dark.png";

	return (
		<nav
			className={`flex flex-col ${sidebarOpen ? "w-64" : "w-14"} transition-all duration-200 bg-base-200 border-r border-base-300 overflow-hidden`}
		>
			{/* App branding + toggle */}
			<div className={`flex items-center gap-2.5 px-3 py-2 shrink-0 ${sidebarOpen ? "" : "justify-center"}`}>
				{sidebarOpen ? (
					<img
						src={splashIcon}
						alt="Packi"
						className="size-7 shrink-0"
					/>
				) : (
					<button
						type="button"
						onClick={toggleSidebar}
						className="shrink-0 cursor-pointer"
						title="Expand sidebar (Ctrl+/)"
					>
						<img src={splashIcon} alt="Packi" className="size-7" />
					</button>
				)}
				{sidebarOpen && (
					<>
						<div className="flex flex-col min-w-0 flex-1">
							<span className="text-sm font-bold tracking-tight leading-tight">Packi</span>
							<button
								type="button"
								onClick={() => openUrl("https://github.com/parkerhdavis/Packi")}
								className="text-xs text-base-content/40 hover:text-primary transition-colors leading-tight text-left cursor-pointer"
							>
								v0.1.0
							</button>
						</div>
						<button
							type="button"
							onClick={toggleSidebar}
							className="btn btn-ghost btn-xs h-7 min-h-0 px-2 shrink-0"
							title="Collapse sidebar (Ctrl+/)"
						>
							<LuPanelLeftClose size={16} />
						</button>
					</>
				)}
			</div>

			<div className="border-b border-base-300 shrink-0" />

			{/* Module navigation */}
			<div className="flex flex-col gap-0.5 pb-3" style={{ flex: "2 1 0%" }}>
				{sidebarOpen && (
					<div className="px-4 pt-2 pb-1 text-xs font-semibold text-base-content/50 uppercase tracking-wider">
						Modules
					</div>
				)}
				{modules.map((m) => (
					<button
						key={m.id}
						type="button"
						onClick={() => setActiveModule(m.id)}
						title={m.tooltip}
						className={`flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors ${
							activeModule === m.id
								? "text-primary bg-primary/10 border-l-2 border-primary"
								: "text-base-content/60 hover:text-base-content hover:bg-base-300/50 border-l-2 border-transparent"
						}`}
					>
						<span className="shrink-0">{m.icon}</span>
						{sidebarOpen && (
							<span className="text-sm font-medium whitespace-nowrap">
								{m.label}
							</span>
						)}
					</button>
				))}
				<button
					type="button"
					onClick={() => setActiveModule("settings")}
					className={`flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors ${
						activeModule === "settings"
							? "text-primary bg-primary/10 border-l-2 border-primary"
							: "text-base-content/60 hover:text-base-content hover:bg-base-300/50 border-l-2 border-transparent"
					}`}
				>
					<span className="shrink-0">
						<LuSettings size={20} />
					</span>
					{sidebarOpen && (
						<span className="text-sm font-medium whitespace-nowrap">
							Settings
						</span>
					)}
				</button>
			</div>

			{/* Directory trees (expanded only) */}
			{sidebarOpen && (
				<div className="flex flex-col min-h-0" style={{ flex: "3 1 0%" }}>
					<div className="flex-1 min-h-0 border-t border-base-300 flex flex-col">
						<DirectoryTree
							label="Input"
							description="Set a working input directory to browse and drag textures from here."
							directory={inputDir ?? null}
							onSetDirectory={(path) => save({ input_dir: path })}
							onClearDirectory={() => save({ input_dir: null })}
						/>
					</div>
					<div className="flex-1 min-h-0 border-t border-base-300 flex flex-col">
						<DirectoryTree
							label="Output"
							description="Set a working output directory. Used as the default export location."
							directory={outputDir ?? null}
							onSetDirectory={(path) => save({ output_dir: path })}
							onClearDirectory={() => save({ output_dir: null })}
						/>
					</div>
				</div>
			)}

			{/* Collapsed directory indicators */}
			{!sidebarOpen && (
				<div className="flex-1 flex flex-col justify-end pb-2 gap-0.5">
					<button
						type="button"
						onClick={toggleSidebar}
						className={`flex items-center justify-center px-4 py-2.5 cursor-pointer transition-colors hover:bg-base-300/50 ${
							inputDir
								? "text-primary"
								: "text-base-content/30"
						}`}
						title={
							inputDir
								? `Input: ${inputDir}`
								: "No input directory set"
						}
					>
						<LuFolderInput size={18} />
					</button>
					<button
						type="button"
						onClick={toggleSidebar}
						className={`flex items-center justify-center px-4 py-2.5 cursor-pointer transition-colors hover:bg-base-300/50 ${
							outputDir
								? "text-primary"
								: "text-base-content/30"
						}`}
						title={
							outputDir
								? `Output: ${outputDir}`
								: "No output directory set"
						}
					>
						<LuFolderOutput size={18} />
					</button>
				</div>
			)}
		</nav>
	);
}
