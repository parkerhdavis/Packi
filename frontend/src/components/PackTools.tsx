import { useCallback } from "react";
import { usePackStore } from "@/stores/packStore";
import type { PackSubmodule } from "@/stores/packStore";
import { useAppStore } from "@/stores/appStore";
import { useToastStore } from "@/stores/toastStore";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import PageHeader from "@/components/ui/PageHeader";
import ExportPanel from "@/components/ui/ExportPanel";
import HistorySidebar from "@/components/HistorySidebar";
import UnpackPanel from "@/components/pack/UnpackPanel";
import SwizzlePanel from "@/components/pack/SwizzlePanel";
import PackPanel from "@/components/pack/PackPanel";
import type { ExportConfig } from "@/types";
import { LuScanLine, LuShuffle, LuLayers } from "react-icons/lu";

const submodules: { id: PackSubmodule; label: string; description: string; icon: React.ReactNode }[] = [
	{ id: "unpack", label: "Unpack", description: "Extract individual channels from a packed texture.", icon: <LuScanLine size={15} /> },
	{ id: "swizzle", label: "Swizzle", description: "Remap channels within a single image.", icon: <LuShuffle size={15} /> },
	{ id: "pack", label: "Pack", description: "Combine separate textures into RGBA channels.", icon: <LuLayers size={15} /> },
];

export default function PackTools() {
	const activeSubmodule = usePackStore((s) => s.activeSubmodule);
	const setSubmodule = usePackStore((s) => s.setSubmodule);
	const historySidebarOpen = useAppStore((s) => s.historySidebarOpen);
	const addToast = useToastStore((s) => s.addToast);

	// Export logic varies per submodule
	const unpackChannelPreviews = usePackStore((s) => s.unpackChannelPreviews);
	const exportUnpackChannel = usePackStore((s) => s.exportUnpackChannel);
	const packChannels = usePackStore((s) => s.packChannels);
	const exportPacked = usePackStore((s) => s.exportPacked);
	const swizzleResultPreview = usePackStore((s) => s.swizzleResultPreview);
	const exportSwizzled = usePackStore((s) => s.exportSwizzled);

	const exportDisabled = (() => {
		switch (activeSubmodule) {
			case "unpack": return unpackChannelPreviews.r === null;
			case "swizzle": return swizzleResultPreview === null;
			case "pack": return !(packChannels.r || packChannels.g || packChannels.b || packChannels.a);
		}
	})();

	const handleExport = useCallback(async (config: ExportConfig) => {
		try {
			const ext = config.format === "png8" || config.format === "png16" ? ".png"
				: config.format === "tga" ? ".tga"
				: config.format === "jpeg" ? ".jpg"
				: ".png";

			switch (usePackStore.getState().activeSubmodule) {
				case "unpack":
					await Promise.all(
						(["r", "g", "b", "a"] as const).map((ch) =>
							exportUnpackChannel(ch, `${config.directory}/${config.filename}_${ch}${ext}`, config.format),
						),
					);
					addToast(`Exported all channels to ${config.filename}_*${ext}`, "success");
					break;
				case "swizzle": {
					const outputPath = `${config.directory}/${config.filename}${ext}`;
					await exportSwizzled(outputPath, config.format);
					addToast(`Exported to ${config.filename}${ext}`, "success");
					break;
				}
				case "pack": {
					const outputPath = `${config.directory}/${config.filename}${ext}`;
					await exportPacked(outputPath, config.format);
					addToast(`Exported to ${config.filename}${ext}`, "success");
					break;
				}
			}
		} catch (err) {
			addToast(`Export failed: ${err}`, "error");
		}
	}, [exportUnpackChannel, exportSwizzled, exportPacked, addToast]);

	const defaultFilename = activeSubmodule === "unpack" ? "unpacked"
		: activeSubmodule === "swizzle" ? "swizzled"
		: "packed";

	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Pack"
				subtitle="Unpack, swizzle, and pack texture channels"
			/>

			<div className="flex flex-1 min-h-0">
				{/* Left control area — sidebar + content + export */}
				<div className="flex flex-col shrink-0 border-r border-base-300" style={{ width: "calc(13rem + 18rem)" }}>
					{/* Interior sidebar + submodule content */}
					<div className="flex flex-1 min-h-0">
						{/* Interior sidebar */}
						<div className="w-52 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto bg-base-200/30">
							<div className="px-3 pt-3 pb-1">
								<div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
									Operations
								</div>
							</div>
							<div className="flex flex-col gap-0.5 px-1.5 pb-2">
								{submodules.map((sub) => (
									<button
										key={sub.id}
										type="button"
										onClick={() => setSubmodule(sub.id)}
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

						{/* Submodule controls column */}
						<div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
							{activeSubmodule === "unpack" && <UnpackPanel />}
							{activeSubmodule === "swizzle" && <SwizzlePanel />}
							{activeSubmodule === "pack" && <PackPanel />}
						</div>
					</div>

					{/* Export bar — spans both columns */}
					<div className="border-t border-base-300 p-3 shrink-0">
						<ExportPanel
							formats={["png8", "png16", "tga"]}
							defaultFormat="png8"
							onExport={handleExport}
							disabled={exportDisabled}
							filenameDefault={defaultFilename}
						/>
					</div>
				</div>

				{/* Right panel — preview area (managed by each submodule) */}
				<div className="flex-1 min-w-0 flex">
					{activeSubmodule === "unpack" && <UnpackPreview />}
					{activeSubmodule === "swizzle" && <SwizzlePreview />}
					{activeSubmodule === "pack" && <PackPreview />}
				</div>

				{/* History sidebar */}
				{historySidebarOpen && <HistorySidebar />}
			</div>
		</div>
	);
}

// --- Preview components extracted so panels only handle controls ---

import TexturePreview from "@/components/ui/TexturePreview";

function UnpackPreview() {
	const previews = usePackStore((s) => s.unpackChannelPreviews);
	const channelLabels = [
		{ key: "r" as const, label: "Red", color: "text-red-400" },
		{ key: "g" as const, label: "Green", color: "text-green-400" },
		{ key: "b" as const, label: "Blue", color: "text-blue-400" },
		{ key: "a" as const, label: "Alpha", color: "text-base-content/50" },
	];

	return (
		<div className="flex-1 min-w-0 grid grid-cols-2 grid-rows-2">
			{channelLabels.map((ch) => (
				<div key={ch.key} className="relative border-b border-r border-base-300 last:border-r-0">
					<div className={`absolute top-2 left-2 z-10 text-xs ${ch.color} bg-base-200/80 px-2 py-0.5 rounded font-medium`}>
						{ch.label}
					</div>
					<TexturePreview
						imageData={previews[ch.key]}
						className="h-full"
					/>
				</div>
			))}
		</div>
	);
}

function SwizzlePreview() {
	const inputPreview = usePackStore((s) => s.swizzleInputPreview);
	const inputInfo = usePackStore((s) => s.swizzleInputInfo);
	const resultPreview = usePackStore((s) => s.swizzleResultPreview);
	const loading = usePackStore((s) => s.swizzlePreviewLoading);

	return (
		<div className="flex-1 min-w-0 flex">
			<div className="flex-1 border-r border-base-300 relative">
				<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
					Before
				</div>
				<TexturePreview
					imageData={inputPreview}
					imageInfo={inputInfo}
					className="h-full"
				/>
			</div>
			<div className="flex-1 relative">
				<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
					After
				</div>
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center bg-base-100/50 z-10">
						<span className="loading loading-spinner loading-md text-primary" />
					</div>
				)}
				<TexturePreview
					imageData={resultPreview ?? inputPreview}
					className="h-full"
				/>
			</div>
		</div>
	);
}

function PackPreview() {
	const preview = usePackStore((s) => s.packPreview);
	const loading = usePackStore((s) => s.packPreviewLoading);

	return (
		<div className="flex-1 min-w-0 relative">
			{loading && (
				<LoadingOverlay bgClass="bg-base-100/50" />
			)}
			<TexturePreview
				imageData={preview}
				className="h-full"
			/>
		</div>
	);
}
