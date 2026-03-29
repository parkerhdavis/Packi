import { useSettingsStore } from "@/stores/settingsStore";
import { useAppStore } from "@/stores/appStore";
import { LuSun, LuMoon, LuPlus, LuMinus } from "react-icons/lu";

const moduleLabels: Record<string, string> = {
	"channel-packer": "Channel Packer",
	"normal-tools": "Normal Map Tools",
	tiling: "Mesh and Tile",
	"file-sizing": "File Sizing",
	"batch-processor": "Batch Processor",
	settings: "Settings",
};

export default function StatusBar() {
	const { toggleTheme, zoomIn, zoomOut, zoomReset } = useSettingsStore();
	const theme = useSettingsStore((s) => s.settings.theme);
	const zoom = useSettingsStore((s) => s.settings.zoom) ?? 100;
	const activeModule = useAppStore((s) => s.activeModule);

	return (
		<footer className="flex items-center justify-between h-7 px-3 bg-base-200 border-t border-base-300 text-xs text-base-content/50 select-none shrink-0">
			<div className="flex items-center gap-2">
				<span className="text-base-content/40">Packi v0.1.0</span>
			</div>

			<div className="flex items-center gap-1">
				<span>{moduleLabels[activeModule] ?? activeModule}</span>
			</div>

			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={toggleTheme}
					className="btn btn-ghost btn-xs h-5 min-h-0 px-1"
					title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
				>
					{theme === "light" ? <LuMoon size={12} /> : <LuSun size={12} />}
				</button>

				<div className="flex items-center gap-0.5 ml-1">
					<button
						type="button"
						onClick={zoomOut}
						className="btn btn-ghost btn-xs h-5 min-h-0 px-1"
						title="Zoom out (Ctrl+-)"
					>
						<LuMinus size={12} />
					</button>
					<button
						type="button"
						onClick={zoomReset}
						className="btn btn-ghost btn-xs h-5 min-h-0 px-0.5 font-mono"
						title="Reset zoom (Ctrl+0)"
					>
						{zoom}%
					</button>
					<button
						type="button"
						onClick={zoomIn}
						className="btn btn-ghost btn-xs h-5 min-h-0 px-1"
						title="Zoom in (Ctrl+=)"
					>
						<LuPlus size={12} />
					</button>
				</div>
			</div>
		</footer>
	);
}
