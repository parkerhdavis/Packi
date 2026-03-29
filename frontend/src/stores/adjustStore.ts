import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ImageInfo } from "@/types";

type AdjustSection = "general" | "normals";

type GeneralOperation = "luminance-curve" | "adjust-hue" | "adjust-saturation";
type NormalOperation = "flip" | "height-to-normal" | "blend" | "normalize";
type AdjustOperation = GeneralOperation | NormalOperation;

interface AdjustState {
	activeSection: AdjustSection;
	activeOperation: AdjustOperation;
	inputPath: string | null;
	inputInfo: ImageInfo | null;
	inputPreview: string | null;
	resultPreview: string | null;
	secondInputPath: string | null;
	secondInputPreview: string | null;
	strength: number;
	blendFactor: number;
	hueOffset: number;
	saturationOffset: number;
	curveLut: number[] | null;
	processing: boolean;
	inputLoading: boolean;
	secondInputLoading: boolean;
	previewLoading: boolean;

	setSection: (section: AdjustSection) => void;
	setOperation: (op: AdjustOperation) => void;
	loadInput: (path: string) => Promise<void>;
	loadSecondInput: (path: string) => Promise<void>;
	clearInput: () => void;
	clearSecondInput: () => void;
	setStrength: (value: number) => void;
	setBlendFactor: (value: number) => void;
	setHueOffset: (value: number) => void;
	setSaturationOffset: (value: number) => void;
	setCurveLut: (lut: number[]) => void;
	regeneratePreview: () => void;
	processOperation: () => Promise<void>;
	exportResult: (outputPath: string, format: string) => Promise<void>;
}

const generalOperations: GeneralOperation[] = ["luminance-curve", "adjust-hue", "adjust-saturation"];
const normalOperations: NormalOperation[] = ["flip", "height-to-normal", "blend", "normalize"];

function sectionForOperation(op: AdjustOperation): AdjustSection {
	if ((generalOperations as string[]).includes(op)) return "general";
	return "normals";
}

function isNormalOperation(op: AdjustOperation): op is NormalOperation {
	return (normalOperations as string[]).includes(op);
}

function isGeneralOperation(op: AdjustOperation): op is GeneralOperation {
	return (generalOperations as string[]).includes(op);
}

let previewDebounce: ReturnType<typeof setTimeout> | null = null;

export const useAdjustStore = create<AdjustState>((set, get) => ({
	activeSection: "general",
	activeOperation: "luminance-curve",
	inputPath: null,
	inputInfo: null,
	inputPreview: null,
	resultPreview: null,
	secondInputPath: null,
	secondInputPreview: null,
	strength: 1.0,
	blendFactor: 0.5,
	hueOffset: 0,
	saturationOffset: 0,
	curveLut: null,
	processing: false,
	inputLoading: false,
	secondInputLoading: false,
	previewLoading: false,

	setSection: (section) => {
		const defaultOp: AdjustOperation = section === "general" ? "luminance-curve" : "flip";
		set({ activeSection: section, activeOperation: defaultOp, resultPreview: null });
	},

	setOperation: (op) => {
		set({
			activeSection: sectionForOperation(op),
			activeOperation: op,
			resultPreview: null,
		});
		get().regeneratePreview();
	},

	loadInput: async (path) => {
		set({ inputLoading: true });
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
				inputLoading: false,
			});
			get().regeneratePreview();
		} catch (err) {
			console.error("Failed to load input:", err);
			set({ inputLoading: false });
		}
	},

	loadSecondInput: async (path) => {
		set({ secondInputLoading: true });
		try {
			const preview = await invoke<string>("load_image_as_base64", { path, maxPreviewSize: 512 });
			set({ secondInputPath: path, secondInputPreview: preview, secondInputLoading: false });
			get().regeneratePreview();
		} catch (err) {
			console.error("Failed to load second input:", err);
			set({ secondInputLoading: false });
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
		get().regeneratePreview();
	},

	setStrength: (value) => {
		set({ strength: value });
		get().regeneratePreview();
	},

	setBlendFactor: (value) => {
		set({ blendFactor: value });
		get().regeneratePreview();
	},

	setHueOffset: (value) => {
		set({ hueOffset: value });
		get().regeneratePreview();
	},

	setSaturationOffset: (value) => {
		set({ saturationOffset: value });
		get().regeneratePreview();
	},

	setCurveLut: (lut) => {
		set({ curveLut: lut });
		get().regeneratePreview();
	},

	regeneratePreview: () => {
		if (previewDebounce) clearTimeout(previewDebounce);
		previewDebounce = setTimeout(async () => {
			const {
				activeOperation, inputPath, secondInputPath,
				strength, blendFactor, hueOffset, saturationOffset, curveLut,
			} = get();
			if (!inputPath) {
				set({ resultPreview: null, previewLoading: false });
				return;
			}

			// General operations
			if (isGeneralOperation(activeOperation)) {
				// Luminance curve needs a LUT to preview
				if (activeOperation === "luminance-curve" && !curveLut) {
					set({ resultPreview: null, previewLoading: false });
					return;
				}

				set({ previewLoading: true });
				try {
					let result: string;
					switch (activeOperation) {
						case "luminance-curve":
							result = await invoke<string>("apply_luminance_curve", {
								path: inputPath,
								lut: curveLut,
								maxPreviewSize: 1024,
							});
							break;
						case "adjust-hue":
							result = await invoke<string>("adjust_hue", {
								path: inputPath,
								offset: hueOffset,
								maxPreviewSize: 1024,
							});
							break;
						case "adjust-saturation":
							result = await invoke<string>("adjust_saturation", {
								path: inputPath,
								offset: saturationOffset,
								maxPreviewSize: 1024,
							});
							break;
					}
					set({ resultPreview: result, previewLoading: false });
				} catch (err) {
					console.error("Auto-preview failed:", err);
					set({ previewLoading: false });
				}
				return;
			}

			// Normal operations
			if (activeOperation === "blend" && !secondInputPath) {
				set({ resultPreview: null, previewLoading: false });
				return;
			}

			set({ previewLoading: true });

			try {
				let result: string;
				switch (activeOperation) {
					case "flip":
						result = await invoke<string>("flip_normal_green", {
							path: inputPath,
							maxPreviewSize: 1024,
						});
						break;
					case "height-to-normal":
						result = await invoke<string>("height_to_normal", {
							path: inputPath,
							strength,
							maxPreviewSize: 1024,
						});
						break;
					case "blend":
						result = await invoke<string>("blend_normals", {
							pathA: inputPath,
							pathB: secondInputPath,
							blendFactor,
							maxPreviewSize: 1024,
						});
						break;
					case "normalize":
						result = await invoke<string>("normalize_map", {
							path: inputPath,
							maxPreviewSize: 1024,
						});
						break;
				}
				set({ resultPreview: result, previewLoading: false });
			} catch (err) {
				console.error("Auto-preview failed:", err);
				set({ previewLoading: false });
			}
		}, 300);
	},

	processOperation: async () => {
		const {
			activeOperation, inputPath, secondInputPath,
			strength, blendFactor, hueOffset, saturationOffset, curveLut,
		} = get();
		if (!inputPath) return;

		set({ processing: true });

		try {
			let result: string;

			if (isGeneralOperation(activeOperation)) {
				switch (activeOperation) {
					case "luminance-curve":
						if (!curveLut) throw new Error("Curve LUT required");
						result = await invoke<string>("apply_luminance_curve", {
							path: inputPath,
							lut: curveLut,
						});
						break;
					case "adjust-hue":
						result = await invoke<string>("adjust_hue", {
							path: inputPath,
							offset: hueOffset,
						});
						break;
					case "adjust-saturation":
						result = await invoke<string>("adjust_saturation", {
							path: inputPath,
							offset: saturationOffset,
						});
						break;
				}
			} else {
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
			}

			set({ resultPreview: result!, processing: false });
		} catch (err) {
			console.error("Processing failed:", err);
			set({ processing: false });
		}
	},

	exportResult: async (outputPath, format) => {
		const {
			activeOperation, inputPath, secondInputPath,
			strength, blendFactor, hueOffset, saturationOffset, curveLut,
		} = get();
		if (!inputPath) return;

		if (isGeneralOperation(activeOperation)) {
			await invoke("export_adjust_result", {
				operation: activeOperation,
				path: inputPath,
				outputPath,
				format,
				lut: activeOperation === "luminance-curve" ? curveLut : null,
				hueOffset: activeOperation === "adjust-hue" ? hueOffset : null,
				saturationOffset: activeOperation === "adjust-saturation" ? saturationOffset : null,
			});
		} else {
			await invoke("export_normal_result", {
				operation: activeOperation,
				path: inputPath,
				outputPath,
				format,
				strength: activeOperation === "height-to-normal" ? strength : null,
				secondPath: activeOperation === "blend" ? secondInputPath : null,
				blendFactor: activeOperation === "blend" ? blendFactor : null,
			});
		}
	},
}));

export type { AdjustSection, AdjustOperation, GeneralOperation, NormalOperation };
