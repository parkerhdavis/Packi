import PageHeader from "@/components/ui/PageHeader";

export default function TilingTools() {
	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="Mesh and Tile"
				subtitle="Seamless tiling preview and mesh tools"
			/>
			<div className="flex-1 flex items-center justify-center text-base-content/30">
				<div className="text-center">
					<p className="text-lg font-medium">Coming soon</p>
					<p className="text-sm mt-1">Mesh and tiling tools are under development.</p>
				</div>
			</div>
		</div>
	);
}
