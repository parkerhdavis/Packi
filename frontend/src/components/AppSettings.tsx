import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import AppearancePanel from "@/components/settings/AppearancePanel";
import FilePathsPanel from "@/components/settings/FilePathsPanel";
import PresetsConfigPanel from "@/components/settings/PresetsConfigPanel";
import AboutPanel from "@/components/settings/AboutPanel";
import { LuPaintbrush, LuFolderOpen, LuSettings2, LuInfo } from "react-icons/lu";

type SettingsSubmodule = "appearance" | "filepaths" | "presets" | "about";

const submodules: { id: SettingsSubmodule; label: string; description: string; icon: React.ReactNode }[] = [
	{ id: "appearance", label: "Appearance", description: "Theme and zoom settings.", icon: <LuPaintbrush size={15} /> },
	{ id: "filepaths", label: "File Paths", description: "Default directories for import and export.", icon: <LuFolderOpen size={15} /> },
	{ id: "presets", label: "Presets & Config", description: "Channel packing presets and default options.", icon: <LuSettings2 size={15} /> },
	{ id: "about", label: "About", description: "Version and credits.", icon: <LuInfo size={15} /> },
];

export default function AppSettings() {
	const [activeSubmodule, setActiveSubmodule] = useState<SettingsSubmodule>("appearance");

	return (
		<div className="flex flex-col h-full">
			<PageHeader title="Settings" />

			<div className="flex flex-1 min-h-0">
				{/* Interior sidebar */}
				<div className="w-64 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto bg-base-200/30">
					<div className="px-3 pt-3 pb-1">
						<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
							Settings
						</div>
					</div>
					<div className="flex flex-col gap-0.5 px-1.5 pb-2">
						{submodules.map((sub) => (
							<button
								key={sub.id}
								type="button"
								onClick={() => setActiveSubmodule(sub.id)}
								className={`flex flex-col gap-0.5 px-2.5 py-2 rounded text-left cursor-pointer transition-colors ${
									activeSubmodule === sub.id
										? "text-primary bg-primary/10 font-medium"
										: "text-base-content/60 hover:text-base-content hover:bg-base-300/50"
								}`}
							>
								<div className="flex items-center gap-2.5">
									<span className="shrink-0 opacity-70">{sub.icon}</span>
									<span className="text-sm">{sub.label}</span>
								</div>
								<span className="text-xs text-base-content/30 leading-snug pl-[1.625rem]">
									{sub.description}
								</span>
							</button>
						))}
					</div>
				</div>

				{/* Content area */}
				<div className="flex-1 min-w-0 overflow-y-auto">
					{activeSubmodule === "appearance" && <AppearancePanel />}
					{activeSubmodule === "filepaths" && <FilePathsPanel />}
					{activeSubmodule === "presets" && <PresetsConfigPanel />}
					{activeSubmodule === "about" && <AboutPanel />}
				</div>
			</div>
		</div>
	);
}
