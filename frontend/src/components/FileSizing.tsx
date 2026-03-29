import PageHeader from "@/components/ui/PageHeader";

export default function FileSizing() {
	return (
		<div className="flex flex-col h-full">
			<PageHeader
				title="File Sizing"
				subtitle="Crop, resize, and recompress textures"
			/>
			<div className="flex-1 flex items-center justify-center text-base-content/30">
				<div className="text-center">
					<p className="text-lg font-medium">Coming soon</p>
					<p className="text-sm mt-1">File sizing tools are under development.</p>
				</div>
			</div>
		</div>
	);
}
