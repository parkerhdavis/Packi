import { useState, useCallback } from "react";
import TexturePreview from "@/components/ui/TexturePreview";
import type { ImageInfo } from "@/types";
import { LuColumns2, LuArrowLeftRight } from "react-icons/lu";

type CompareMode = "side-by-side" | "ab-toggle";

interface ComparisonViewProps {
	beforeImage: string | null;
	afterImage: string | null;
	beforeInfo?: ImageInfo | null;
	afterInfo?: ImageInfo | null;
	beforeLabel?: string;
	afterLabel?: string;
	className?: string;
}

export default function ComparisonView({
	beforeImage,
	afterImage,
	beforeInfo,
	afterInfo,
	beforeLabel = "Before",
	afterLabel = "After",
	className = "",
}: ComparisonViewProps) {
	const [mode, setMode] = useState<CompareMode>("side-by-side");
	const [abShowAfter, setAbShowAfter] = useState(false);
	const [syncZoom, setSyncZoom] = useState(1);
	const [syncPan, setSyncPan] = useState({ x: 0, y: 0 });

	const handleViewChange = useCallback((zoom: number, pan: { x: number; y: number }) => {
		setSyncZoom(zoom);
		setSyncPan(pan);
	}, []);

	return (
		<div className={`flex flex-col h-full ${className}`}>
			{/* Mode toolbar */}
			<div className="flex items-center gap-1 px-2 py-1 border-b border-base-300 bg-base-200/50 shrink-0">
				<span className="text-xs text-base-content/40 mr-1">Compare:</span>
				<button
					type="button"
					onClick={() => setMode("side-by-side")}
					className={`btn btn-xs h-6 min-h-0 px-2 gap-1 ${mode === "side-by-side" ? "btn-primary" : "btn-ghost"}`}
					title="Side by side"
				>
					<LuColumns2 size={12} />
					<span>Split</span>
				</button>
				<button
					type="button"
					onClick={() => setMode("ab-toggle")}
					className={`btn btn-xs h-6 min-h-0 px-2 gap-1 ${mode === "ab-toggle" ? "btn-primary" : "btn-ghost"}`}
					title="A/B toggle"
				>
					<LuArrowLeftRight size={12} />
					<span>A/B</span>
				</button>
				<div className="flex-1" />
				<span className="text-xs text-base-content/40 tabular-nums">
					{(syncZoom * 100).toFixed(0)}%
				</span>
				{(beforeInfo || afterInfo) && (
					<span className="text-xs text-base-content/40 ml-1">
						{(beforeInfo ?? afterInfo)!.width}×{(beforeInfo ?? afterInfo)!.height}
					</span>
				)}
			</div>

			{/* Content */}
			{mode === "side-by-side" && (
				<div className="flex-1 min-h-0 flex">
					<div className="flex-1 border-r border-base-300 relative">
						<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
							{beforeLabel}
						</div>
						<TexturePreview
							imageData={beforeImage}
							imageInfo={beforeInfo}
							className="h-full"
							hideToolbar
							controlledZoom={syncZoom}
							controlledPan={syncPan}
							onViewChange={handleViewChange}
						/>
					</div>
					<div className="flex-1 relative">
						<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
							{afterLabel}
						</div>
						<TexturePreview
							imageData={afterImage ?? beforeImage}
							className="h-full"
							hideToolbar
							controlledZoom={syncZoom}
							controlledPan={syncPan}
							onViewChange={handleViewChange}
						/>
					</div>
				</div>
			)}

			{mode === "ab-toggle" && (
				<div className="flex-1 min-h-0 relative">
					<div className="absolute top-2 left-2 z-10 text-xs text-base-content/40 bg-base-200/80 px-2 py-0.5 rounded">
						{abShowAfter ? afterLabel : beforeLabel}
					</div>
					<button
						type="button"
						onClick={() => setAbShowAfter((v) => !v)}
						className="absolute top-2 right-2 z-10 btn btn-xs h-6 min-h-0 px-2 btn-ghost bg-base-200/80"
						title="Toggle A/B (click or press Space)"
					>
						<LuArrowLeftRight size={12} />
					</button>
					<TexturePreview
						imageData={abShowAfter ? (afterImage ?? beforeImage) : beforeImage}
						imageInfo={abShowAfter ? afterInfo : beforeInfo}
						className="h-full"
						hideToolbar
						controlledZoom={syncZoom}
						controlledPan={syncPan}
						onViewChange={handleViewChange}
					/>
				</div>
			)}
		</div>
	);
}
