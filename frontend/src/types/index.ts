export interface AppSettings {
	theme: string | null;
	zoom: number | null;
	window_width: number | null;
	window_height: number | null;
	last_export_dir: string | null;
	last_module: string | null;
	sidebar_open: boolean | null;
	input_dir: string | null;
	output_dir: string | null;
}

export interface DirEntry {
	name: string;
	path: string;
	is_dir: boolean;
}

export type ModuleName =
	| "channel-packer"
	| "adjust"
	| "tiling"
	| "file-sizing"
	| "batch-processor"
	| "settings";

export interface ImageInfo {
	width: number;
	height: number;
	channels: number;
	format: string;
	bit_depth: number;
	file_size: number;
}

export type ChannelSource = "r" | "g" | "b" | "a" | "luminance";

export type ExportFormat = "png8" | "png16" | "tga" | "jpeg" | "exr";

export interface ExportConfig {
	format: ExportFormat;
	directory: string;
	filename: string;
}

export interface Toast {
	id: string;
	message: string;
	type: "info" | "success" | "warning" | "error";
}
