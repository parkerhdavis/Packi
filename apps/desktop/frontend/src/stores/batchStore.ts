import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface BatchStep {
	type: "convert" | "resize" | "rename" | "flip-green" | "normalize";
	format?: string;
	bit_depth?: number;
	mode?: string;
	width?: number;
	height?: number;
	filter?: string;
	pattern?: string;
}

interface BatchPreviewItem {
	input_path: string;
	output_filename: string;
	output_format: string;
}

interface BatchResult {
	processed: number;
	failed: Array<{ path: string; error: string }>;
}

interface BatchProgress {
	current: number;
	total: number;
	current_file: string;
}

interface NamedPipeline {
	name: string;
	steps: BatchStep[];
}

interface BatchState {
	inputFiles: string[];
	pipeline: BatchStep[];
	outputDir: string | null;
	previewItems: BatchPreviewItem[];
	running: boolean;
	progress: BatchProgress | null;
	result: BatchResult | null;
	presets: NamedPipeline[];
	recursive: boolean;
	continueOnError: boolean;

	addFiles: (paths: string[]) => void;
	addFolder: (dir: string) => Promise<void>;
	removeFile: (index: number) => void;
	clearFiles: () => void;
	addStep: (step: BatchStep) => void;
	removeStep: (index: number) => void;
	updateStep: (index: number, step: BatchStep) => void;
	moveStep: (from: number, to: number) => void;
	setOutputDir: (dir: string) => void;
	setRecursive: (recursive: boolean) => void;
	setContinueOnError: (continueOnError: boolean) => void;
	previewPipeline: () => Promise<void>;
	runPipeline: () => Promise<void>;
	loadPresets: () => Promise<void>;
	savePreset: (name: string) => Promise<void>;
	deletePreset: (name: string) => Promise<void>;
}

export const useBatchStore = create<BatchState>((set, get) => ({
	inputFiles: [],
	pipeline: [],
	outputDir: null,
	previewItems: [],
	running: false,
	progress: null,
	result: null,
	presets: [],
	recursive: false,
	continueOnError: true,

	addFiles: (paths) => {
		set((s) => ({
			inputFiles: [...s.inputFiles, ...paths.filter((p) => !s.inputFiles.includes(p))],
			result: null,
		}));
	},

	addFolder: async (dir) => {
		try {
			const files = await invoke<string[]>("list_image_files", { dir, recursive: get().recursive });
			get().addFiles(files);
		} catch (err) {
			console.error("Failed to list image files:", err);
		}
	},

	removeFile: (index) => {
		set((s) => ({
			inputFiles: s.inputFiles.filter((_, i) => i !== index),
		}));
	},

	clearFiles: () => set({ inputFiles: [], previewItems: [], result: null }),

	addStep: (step) => {
		set((s) => ({
			pipeline: [...s.pipeline, step],
		}));
	},

	removeStep: (index) => {
		set((s) => ({
			pipeline: s.pipeline.filter((_, i) => i !== index),
		}));
	},

	updateStep: (index, step) => {
		set((s) => ({
			pipeline: s.pipeline.map((s, i) => (i === index ? step : s)),
		}));
	},

	moveStep: (from, to) => {
		set((s) => {
			const steps = [...s.pipeline];
			const [moved] = steps.splice(from, 1);
			steps.splice(to, 0, moved);
			return { pipeline: steps };
		});
	},

	setOutputDir: (dir) => set({ outputDir: dir }),
	setRecursive: (recursive) => set({ recursive }),
	setContinueOnError: (continueOnError) => set({ continueOnError }),

	previewPipeline: async () => {
		const { inputFiles, pipeline } = get();
		if (inputFiles.length === 0) return;

		try {
			const items = await invoke<BatchPreviewItem[]>("preview_batch", {
				files: inputFiles,
				pipeline: { steps: pipeline },
			});
			set({ previewItems: items });
		} catch (err) {
			console.error("Preview failed:", err);
		}
	},

	runPipeline: async () => {
		const { inputFiles, pipeline, outputDir, continueOnError } = get();
		if (inputFiles.length === 0 || !outputDir) return;

		set({ running: true, progress: null, result: null });

		// Listen for progress events
		const unlisten = await listen<BatchProgress>("batch-progress", (event) => {
			set({ progress: event.payload });
		});

		try {
			const result = await invoke<BatchResult>("run_batch", {
				files: inputFiles,
				pipeline: { steps: pipeline },
				outputDir,
				continueOnError,
			});
			set({ result, running: false });
		} catch (err) {
			console.error("Batch processing failed:", err);
			set({ running: false });
		} finally {
			unlisten();
		}
	},

	loadPresets: async () => {
		try {
			const presets = await invoke<NamedPipeline[]>("load_pipeline_presets");
			set({ presets });
		} catch (err) {
			console.error("Failed to load pipeline presets:", err);
		}
	},

	savePreset: async (name) => {
		const { pipeline } = get();
		await invoke("save_pipeline_preset", { name, steps: pipeline });
		await get().loadPresets();
	},

	deletePreset: async (name) => {
		await invoke("delete_pipeline_preset", { name });
		await get().loadPresets();
	},
}));
