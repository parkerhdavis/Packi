import PageHeader from "@/components/ui/PageHeader";

export default function TilingTools() {
	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Tiling"
				subtitle="Seamless tiling preview and adjustments"
			/>
			<div className="flex-1 flex items-center justify-center text-base-content/30">
				<div className="text-center">
					<p className="text-lg font-medium">Coming soon</p>
					<p className="text-sm mt-1">Tiling tools are under development.</p>
				</div>
			</div>
		</div>
	);
}
