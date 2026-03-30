import { useState } from "react";
import { useSizeStore } from "@/stores/sizeStore";
import TexturePreview from "@/components/ui/TexturePreview";
import { GPU_FORMATS, computeTotalWithMips, formatBytes } from "@/components/size/vramFormats";

export default function VramBudgetPanel() {
	const info = useSizeStore((s) => s.inputInfo);
	const preview = useSizeStore((s) => s.inputPreview);
	const [includeMips, setIncludeMips] = useState(true);

	if (!info) {
		return (
			<div className="flex-1 flex items-center justify-center text-base-content/30 text-sm">
				Load an image to estimate VRAM usage.
			</div>
		);
	}

	const { width, height } = info;

	const estimates = GPU_FORMATS.map((fmt) => {
		const baseSize = fmt.sizeBytes(width, height);
		const totalSize = includeMips ? computeTotalWithMips(fmt, width, height) : baseSize;
		return { ...fmt, baseSize, totalSize };
	});

	// For the bar chart, find the max size
	const maxSize = Math.max(...estimates.map((e) => e.totalSize));

	return (
		<div className="flex-1 min-w-0 flex">
			{/* VRAM table */}
			<div className="w-[26rem] shrink-0 border-r border-base-300 flex flex-col overflow-y-auto">
				<div className="p-4 pb-2 shrink-0">
					<div className="flex items-center justify-between mb-3">
						<div className="text-sm font-semibold text-base-content">VRAM Budget</div>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={includeMips}
								onChange={(e) => setIncludeMips(e.target.checked)}
								className="checkbox checkbox-xs checkbox-primary"
							/>
							<span className="text-xs text-base-content/60">Include mip chain</span>
						</label>
					</div>
					<div className="text-xs text-base-content/40 mb-3">
						Estimated GPU memory for a {width}×{height} texture{includeMips ? " with full mip chain" : ""}.
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-4 pb-4">
					<table className="w-full">
						<thead>
							<tr className="text-xs text-base-content/40 border-b border-base-300">
								<th className="text-left py-1.5 font-medium">Format</th>
								<th className="text-right py-1.5 font-medium pr-3 w-16">BPP</th>
								<th className="text-right py-1.5 font-medium w-24">Size</th>
								<th className="py-1.5 w-24" />
							</tr>
						</thead>
						<tbody>
							{estimates.map((est) => (
								<tr key={est.name} className="border-b border-base-300/30 last:border-0">
									<td className="py-1.5">
										<div className="text-xs font-medium text-base-content/80">{est.name}</div>
										<div className="text-xs text-base-content/30">{est.description}</div>
									</td>
									<td className="text-right text-xs font-mono text-base-content/50 pr-3">
										{est.bpp % 1 === 0 ? est.bpp : est.bpp.toFixed(2)}
									</td>
									<td className="text-right text-xs font-mono text-base-content/80">
										{formatBytes(est.totalSize)}
									</td>
									<td className="py-1.5 pl-2">
										<div className="h-2 bg-base-300/50 rounded-full overflow-hidden">
											<div
												className="h-full bg-primary/60 rounded-full"
												style={{ width: `${(est.totalSize / maxSize) * 100}%` }}
											/>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Preview */}
			<TexturePreview
				imageData={preview}
				imageInfo={info}
				className="flex-1"
			/>
		</div>
	);
}
