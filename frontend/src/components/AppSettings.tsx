import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettingsStore } from "@/stores/settingsStore";
import PageHeader from "@/components/ui/PageHeader";
import { LuFolderOpen } from "react-icons/lu";

export default function AppSettings() {
	const { settings, save, toggleTheme, zoomIn, zoomOut, zoomReset } = useSettingsStore();
	const zoom = settings.zoom ?? 100;

	const handlePickExportDir = useCallback(async () => {
		const result = await open({ directory: true });
		if (result) {
			await save({ last_export_dir: result as string });
		}
	}, [save]);

	return (
		<div className="flex flex-col h-full">
			<PageHeader title="Settings" />

			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-lg space-y-8">
					{/* Theme */}
					<section>
						<h2 className="text-sm font-semibold mb-3">Appearance</h2>
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

					{/* Default export directory */}
					<section>
						<h2 className="text-sm font-semibold mb-3">Default Export Directory</h2>
						<div className="flex gap-2 items-center">
							<input
								type="text"
								value={settings.last_export_dir ?? ""}
								readOnly
								placeholder="No directory set"
								className="input input-sm input-bordered flex-1 font-mono text-xs"
							/>
							<button
								type="button"
								onClick={handlePickExportDir}
								className="btn btn-sm btn-ghost"
							>
								<LuFolderOpen size={16} />
							</button>
						</div>
					</section>

					{/* About */}
					<section>
						<h2 className="text-sm font-semibold mb-3">About</h2>
						<div className="flex items-start gap-3">
							<img
								src={settings.theme === "light" ? "/packi-splash-light.png" : "/packi-splash-dark.png"}
								alt="Packi"
								className="size-10 shrink-0"
							/>
							<div className="text-sm text-base-content/60 space-y-1">
								<p><strong>Packi</strong> v0.1.0</p>
								<p>Texture packing and asset prep toolkit for game artists.</p>
								<p>
									Developed by{" "}
									<button
										type="button"
										onClick={() => openUrl("https://parkerhdavis.com")}
										className="text-primary hover:underline cursor-pointer"
									>
										Parker H. Davis
									</button>
								</p>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
