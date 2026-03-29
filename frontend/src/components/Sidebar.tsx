import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ModuleName } from "@/types";
import {
	LuLayers,
	LuCompass,
	LuFolderCog,
	LuSettings,
	LuPanelLeftClose,
	LuPanelLeftOpen,
	LuFolderInput,
	LuFolderOutput,
} from "react-icons/lu";
import DirectoryTree from "@/components/ui/DirectoryTree";

const modules: { id: ModuleName; label: string; icon: React.ReactNode }[] = [
	{ id: "channel-packer", label: "Channel Packer", icon: <LuLayers size={20} /> },
	{ id: "normal-tools", label: "Normal Map", icon: <LuCompass size={20} /> },
	{ id: "batch-processor", label: "Batch", icon: <LuFolderCog size={20} /> },
];

export default function Sidebar() {
	const activeModule = useAppStore((s) => s.activeModule);
	const setActiveModule = useAppStore((s) => s.setActiveModule);
	const sidebarOpen = useAppStore((s) => s.sidebarOpen);
	const toggleSidebar = useAppStore((s) => s.toggleSidebar);

	const inputDir = useSettingsStore((s) => s.settings.input_dir);
	const outputDir = useSettingsStore((s) => s.settings.output_dir);
	const save = useSettingsStore((s) => s.save);

	return (
		<nav
			className={`flex flex-col ${sidebarOpen ? "w-64" : "w-14"} transition-all duration-200 bg-base-200 border-r border-base-300 overflow-hidden`}
		>
			{/* Toggle button */}
			<div className="flex items-center px-3 py-2 shrink-0">
				<button
					type="button"
					onClick={toggleSidebar}
					className="btn btn-ghost btn-xs h-7 min-h-0 px-2"
					title={sidebarOpen ? "Collapse sidebar (Ctrl+/)" : "Expand sidebar (Ctrl+/)"}
				>
					{sidebarOpen ? (
						<LuPanelLeftClose size={16} />
					) : (
						<LuPanelLeftOpen size={16} />
					)}
				</button>
			</div>

			{/* Module navigation */}
			<div className="flex flex-col gap-0.5 shrink-0">
				{modules.map((m) => (
					<button
						key={m.id}
						type="button"
						onClick={() => setActiveModule(m.id)}
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
				<>
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
				</>
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
