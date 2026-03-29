import { useAppStore } from "@/stores/appStore";
import type { ModuleName } from "@/types";
import { LuLayers, LuCompass, LuFolderCog, LuSettings } from "react-icons/lu";

const modules: { id: ModuleName; label: string; icon: React.ReactNode }[] = [
	{ id: "channel-packer", label: "Channel Packer", icon: <LuLayers size={20} /> },
	{ id: "normal-tools", label: "Normal Map", icon: <LuCompass size={20} /> },
	{ id: "batch-processor", label: "Batch", icon: <LuFolderCog size={20} /> },
];

export default function Sidebar() {
	const activeModule = useAppStore((s) => s.activeModule);
	const setActiveModule = useAppStore((s) => s.setActiveModule);

	return (
		<nav className="flex flex-col w-14 hover:w-44 transition-all duration-200 bg-base-200 border-r border-base-300 overflow-hidden group">
			<div className="flex flex-col flex-1 pt-2 gap-0.5">
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
						<span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
							{m.label}
						</span>
					</button>
				))}
			</div>

			<div className="pb-2">
				<button
					type="button"
					onClick={() => setActiveModule("settings")}
					className={`flex items-center gap-3 px-4 py-2.5 w-full text-left cursor-pointer transition-colors ${
						activeModule === "settings"
							? "text-primary bg-primary/10 border-l-2 border-primary"
							: "text-base-content/60 hover:text-base-content hover:bg-base-300/50 border-l-2 border-transparent"
					}`}
				>
					<span className="shrink-0"><LuSettings size={20} /></span>
					<span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
						Settings
					</span>
				</button>
			</div>
		</nav>
	);
}
