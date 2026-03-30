import { useEffect } from "react";
import { usePackStore } from "@/stores/packStore";
import ChannelSlotCard from "@/components/ChannelSlotCard";

export default function PackPanel() {
	const {
		packPresets,
		packActivePreset,
		packPresetLabels,
		loadPresets,
		applyPreset,
		clearPreset,
	} = usePackStore();

	useEffect(() => {
		loadPresets();
	}, [loadPresets]);

	return (
		<>
			{/* Header */}
			<div className="px-3 pt-3 pb-2 border-b border-base-300 shrink-0">
				<div className="text-sm font-semibold text-base-content">Pack</div>
				<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
					Combine separate grayscale textures into a single RGBA image. Use presets for common engine formats.
				</div>
			</div>

			<div className="p-3 space-y-2">
				{/* Preset selector */}
				<div className="flex gap-2 items-center">
					<select
						value={packActivePreset ?? ""}
						onChange={(e) => {
							const val = e.target.value;
							if (val) applyPreset(val);
							else clearPreset();
						}}
						className="select select-xs select-bordered flex-1"
					>
						<option value="">No preset</option>
						{packPresets.map((p) => (
							<option key={p.name} value={p.name}>
								{p.name}
							</option>
						))}
					</select>
				</div>

				{/* Channel slots */}
				<ChannelSlotCard slot="r" label={packPresetLabels?.r} />
				<ChannelSlotCard slot="g" label={packPresetLabels?.g} />
				<ChannelSlotCard slot="b" label={packPresetLabels?.b} />
				<ChannelSlotCard slot="a" label={packPresetLabels?.a} />
			</div>
		</>
	);
}
