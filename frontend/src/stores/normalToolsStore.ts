import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ImageInfo } from "@/types";

type NormalOperation = "flip" | "height-to-normal" | "blend" | "normalize";

interface NormalToolsState {
	activeOperation: NormalOperation;
	inputPath: string | null;
	inputInfo: ImageInfo | null;
	inputPreview: string | null;
	resultPreview: string | null;
	secondInputPath: string | null;
	secondInputPreview: string | null;
	strength: number;
	blendFactor: number;
	processing: boolean;

	setOperation: (op: NormalOperation) => void;
	loadInput: (path: string) => Promise<void>;
	loadSecondInput: (path: string) => Promise<void>;
	clearInput: () => void;
	clearSecondInput: () => void;
	setStrength: (value: number) => void;
	setBlendFactor: (value: number) => void;
	processOperation: () => Promise<void>;
	exportResult: (outputPath: string, format: string) => Promise<void>;
}

export const useNormalToolsStore = create<NormalToolsState>((set, get) => ({
	activeOperation: "flip",
	inputPath: null,
	inputInfo: null,
	inputPreview: null,
	resultPreview: null,
	secondInputPath: null,
	secondInputPreview: null,
	strength: 1.0,
	blendFactor: 0.5,
	processing: false,

	setOperation: (op) => {
		set({
			activeOperation: op,
			resultPreview: null,
		});
	},

	loadInput: async (path) => {
		try {
			const [info, preview] = await Promise.all([
				invoke<ImageInfo>("load_image_info", { path }),
				invoke<string>("load_image_as_base64", { path, maxPreviewSize: 512 }),
			]);
			set({
				inputPath: path,
				inputInfo: info,
				inputPreview: preview,
				resultPreview: null,
			});
		} catch (err) {
			console.error("Failed to load input:", err);
		}
	},

	loadSecondInput: async (path) => {
		try {
			const preview = await invoke<string>("load_image_as_base64", { path, maxPreviewSize: 512 });
			set({ secondInputPath: path, secondInputPreview: preview });
		} catch (err) {
			console.error("Failed to load second input:", err);
		}
	},

	clearInput: () => {
		set({
			inputPath: null,
			inputInfo: null,
			inputPreview: null,
			resultPreview: null,
		});
	},

	clearSecondInput: () => {
		set({ secondInputPath: null, secondInputPreview: null });
	},

	setStrength: (value) => set({ strength: value }),
	setBlendFactor: (value) => set({ blendFactor: value }),

	processOperation: async () => {
		const { activeOperation, inputPath, secondInputPath, strength, blendFactor } = get();
		if (!inputPath) return;

		set({ processing: true });

		try {
			let result: string;
			switch (activeOperation) {
				case "flip":
					result = await invoke<string>("flip_normal_green", { path: inputPath });
					break;
				case "height-to-normal":
					result = await invoke<string>("height_to_normal", { path: inputPath, strength });
					break;
				case "blend":
					if (!secondInputPath) throw new Error("Second input required for blend");
					result = await invoke<string>("blend_normals", {
						pathA: inputPath,
						pathB: secondInputPath,
						blendFactor,
					});
					break;
				case "normalize":
					result = await invoke<string>("normalize_map", { path: inputPath });
					break;
			}
			set({ resultPreview: result, processing: false });
		} catch (err) {
			console.error("Processing failed:", err);
			set({ processing: false });
		}
	},

	exportResult: async (outputPath, format) => {
		const { activeOperation, inputPath, secondInputPath, strength, blendFactor } = get();
		if (!inputPath) return;

		await invoke("export_normal_result", {
			operation: activeOperation,
			path: inputPath,
			outputPath,
			format,
			strength: activeOperation === "height-to-normal" ? strength : null,
			secondPath: activeOperation === "blend" ? secondInputPath : null,
			blendFactor: activeOperation === "blend" ? blendFactor : null,
		});
	},
}));
