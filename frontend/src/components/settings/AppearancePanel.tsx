import { useSettingsStore } from "@/stores/settingsStore";

export default function AppearancePanel() {
	const { settings, toggleTheme, zoomIn, zoomOut, zoomReset } = useSettingsStore();
	const zoom = settings.zoom ?? 100;

	return (
		<div className="p-6 max-w-lg space-y-8">
			{/* Theme */}
			<section>
				<h2 className="text-sm font-semibold mb-3">Theme</h2>
				<div className="flex gap-3">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="theme"
							className="radio radio-primary radio-sm"
							checked={settings.theme !== "light"}
							onChange={() => { if (settings.theme === "light") toggleTheme(); }}
						/>
						<span className="text-sm">Dark</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="theme"
							className="radio radio-primary radio-sm"
							checked={settings.theme === "light"}
							onChange={() => { if (settings.theme !== "light") toggleTheme(); }}
						/>
						<span className="text-sm">Light</span>
					</label>
				</div>
			</section>

			{/* Zoom */}
			<section>
				<h2 className="text-sm font-semibold mb-3">Zoom</h2>
				<div className="flex items-center gap-3">
					<button type="button" onClick={zoomOut} className="btn btn-sm btn-ghost">
						-
					</button>
					<span className="font-mono text-sm w-12 text-center">{zoom}%</span>
					<button type="button" onClick={zoomIn} className="btn btn-sm btn-ghost">
						+
					</button>
					<button type="button" onClick={zoomReset} className="btn btn-sm btn-ghost">
						Reset
					</button>
				</div>
				<p className="text-xs text-base-content/40 mt-1">
					Keyboard: Ctrl+= / Ctrl+- / Ctrl+0
				</p>
			</section>
		</div>
	);
}
