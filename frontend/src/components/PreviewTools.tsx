import { useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores/appStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useToastStore } from "@/stores/toastStore";
import type { PreviewSubmodule } from "@/stores/previewStore";
import type { ExportConfig } from "@/types";
import type { PreviewPanelHandle } from "@/types/pbr";
import PageHeader from "@/components/ui/PageHeader";
import ExportPanel from "@/components/ui/ExportPanel";
import HistorySidebar from "@/components/HistorySidebar";
import TilingPreviewPanel from "@/components/preview/TilingPreviewPanel";
import MaterialPreviewPanel from "@/components/preview/MaterialPreviewPanel";
import { LuGrid3X3, LuBox } from "react-icons/lu";

const submodules: { id: PreviewSubmodule; label: string; description: string; icon: React.ReactNode }[] = [
	{ id: "2d", label: "2D Preview", description: "Tile a texture in a grid to check seamlessness.", icon: <LuGrid3X3 size={15} /> },
	{ id: "3d", label: "3D Preview", description: "Preview materials on 3D geometry with PBR lighting.", icon: <LuBox size={15} /> },
];

export default function PreviewTools() {
	const activeSubmodule = usePreviewStore((s) => s.activeSubmodule);
	const setActiveSubmodule = usePreviewStore((s) => s.setSubmodule);
	const historySidebarOpen = useAppStore((s) => s.historySidebarOpen);
	const addToast = useToastStore((s) => s.addToast);

	const tilingInputPath = usePreviewStore((s) => s.tilingInputPath);
	const materialTexturePaths = usePreviewStore((s) => s.materialTexturePaths);

	const tilingRef = useRef<PreviewPanelHandle>(null);
	const materialRef = useRef<PreviewPanelHandle>(null);

	const exportDisabled = activeSubmodule === "2d"
		? !tilingInputPath
		: !Object.values(materialTexturePaths).some(Boolean);

	const handleExport = useCallback(async (config: ExportConfig) => {
		const panelRef = activeSubmodule === "2d" ? tilingRef : materialRef;
		const data = panelRef.current?.captureViewport();
		if (!data) {
			addToast("Nothing to export — load a texture first", "warning");
			return;
		}

		const ext = config.format === "png8" || config.format === "png16" ? ".png"
			: config.format === "tga" ? ".tga"
			: config.format === "jpeg" ? ".jpg"
			: ".png";
		const outputPath = `${config.directory}/${config.filename}${ext}`;

		await invoke("save_viewport", { data, outputPath, format: config.format });
		addToast(`Exported to ${config.filename}${ext}`, "success");
	}, [activeSubmodule, addToast]);

	const defaultFilename = activeSubmodule === "2d" ? "tiling_preview" : "material_preview";

	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Preview"
				subtitle="2D tiling and 3D material preview"
			/>

			<div className="flex flex-1 min-h-0">
				{/* Interior sidebar */}
				<div className="w-52 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto bg-base-200/30">
					<div className="px-3 pt-3 pb-1">
						<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
							Modes
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
				<div className="flex-1 min-w-0 flex relative">
					{activeSubmodule === "2d" && <TilingPreviewPanel ref={tilingRef} />}
					{activeSubmodule === "3d" && <MaterialPreviewPanel ref={materialRef} />}

					{/* Export overlay — bottom-right of viewport */}
					<div className="absolute bottom-3 right-3 z-20 w-64">
						<ExportPanel
							formats={["png8", "jpeg"]}
							defaultFormat="png8"
							onExport={handleExport}
							disabled={exportDisabled}
							filenameDefault={defaultFilename}
							moduleKey="preview"
						/>
					</div>
				</div>

				{/* History sidebar */}
				{historySidebarOpen && <HistorySidebar />}
			</div>
		</div>
	);
}
