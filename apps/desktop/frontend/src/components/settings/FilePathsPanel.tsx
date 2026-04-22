import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "@/stores/settingsStore";
import { LuFolderOpen } from "react-icons/lu";

export default function FilePathsPanel() {
	const { settings, save } = useSettingsStore();

	const handlePickExportDir = useCallback(async () => {
		const result = await open({ directory: true });
		if (result) {
			await save({ last_export_dir: result as string });
		}
	}, [save]);

	return (
		<div className="p-6 max-w-lg space-y-8">
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
		</div>
	);
}
