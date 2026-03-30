import { usePackStore } from "@/stores/packStore";
import type { PackSubmodule } from "@/stores/packStore";
import { useAppStore } from "@/stores/appStore";
import PageHeader from "@/components/ui/PageHeader";
import HistorySidebar from "@/components/HistorySidebar";
import UnpackPanel from "@/components/pack/UnpackPanel";
import SwizzlePanel from "@/components/pack/SwizzlePanel";
import PackPanel from "@/components/pack/PackPanel";
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

	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Pack"
				subtitle="Unpack, swizzle, and pack texture channels"
			/>

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

				{/* Submodule content area */}
				<div className="flex-1 min-w-0 flex">
					{activeSubmodule === "unpack" && <UnpackPanel />}
					{activeSubmodule === "swizzle" && <SwizzlePanel />}
					{activeSubmodule === "pack" && <PackPanel />}
				</div>

				{/* History sidebar */}
				{historySidebarOpen && <HistorySidebar />}
			</div>
		</div>
	);
}
